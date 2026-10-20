import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 * Next.js App Router idempotent Stripe Webhook handler.
 * Verifies webhook signatures using raw body text and provisions user accounts.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured.');
    return NextResponse.json(
      { error: 'Webhook secret is missing from server environment.' },
      { status: 500 }
    );
  }

  // 1. Read raw text body for cryptographic signature verification
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err: any) {
    console.error('[Stripe Webhook] Error reading raw body:', err);
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.warn('[Stripe Webhook] Missing stripe-signature header.');
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // 2. Cryptographic signature check
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  await dbConnect();

  try {
    // 3. Handle events idempotently
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const userEmail = session.metadata?.email || session.customer_details?.email;
        const customerId = session.customer as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        console.log(`[Stripe Webhook] checkout.session.completed for user: ${userId || userEmail}`);

        // Set subscription validity for 31 days (or period from Stripe)
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 31);

        // Find user by ID or email
        let user = null;
        if (userId && !userId.startsWith('guest_')) {
          user = await User.findById(userId);
        }
        if (!user && userEmail) {
          user = await User.findOne({ email: userEmail });
        }

        if (user) {
          user.is_pro = true;
          user.subscription_status = 'active';
          user.valid_until = validUntil;
          if (customerId) user.stripe_customer_id = customerId;
          if (subscriptionId) user.stripe_subscription_id = subscriptionId;
          await user.save();
          console.log(`[Stripe Webhook] User ${user.email} successfully provisioned to Pro.`);
        } else {
          console.warn(`[Stripe Webhook] No user found for session ${session.id} (Email: ${userEmail})`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | undefined;

        if (customerId) {
          const user = await User.findOne({ stripe_customer_id: customerId });
          if (user) {
            const nextPeriodEnd = invoice.lines?.data[0]?.period?.end
              ? new Date(invoice.lines.data[0].period.end * 1000)
              : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

            user.is_pro = true;
            user.subscription_status = 'active';
            user.valid_until = nextPeriodEnd;
            await user.save();
            console.log(`[Stripe Webhook] Extended Pro status for ${user.email} until ${nextPeriodEnd.toISOString()}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`[Stripe Webhook] Subscription canceled for customer: ${customerId}`);
        const user = await User.findOne({ stripe_customer_id: customerId });
        if (user) {
          user.is_pro = false;
          user.subscription_status = 'canceled';
          await user.save();
          console.log(`[Stripe Webhook] Reverted user ${user.email} to free tier.`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.warn(`[Stripe Webhook] Payment failed for invoice: ${invoice.id}, customer: ${customerId}`);
        const user = await User.findOne({ stripe_customer_id: customerId });
        if (user) {
          user.subscription_status = 'past_due';
          await user.save();
        }
        break;
      }

      default:
        // Ignore unhandled event types gracefully
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed while provisioning account.' },
      { status: 500 }
    );
  }
}
