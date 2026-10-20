import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout
 * Initiates a Stripe Checkout session configured for the Netherlands.
 * Supports: iDEAL, Bancontact, and Card.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json().catch(() => ({}));

    await dbConnect();

    // Authenticated user lookup or fallback to provided parent email identifier
    let userIdentifier = session?.user?.email || body.email;
    if (!userIdentifier) {
      return NextResponse.json(
        { error: 'Inloggen vereist of geef een geldig e-mailadres op.' },
        { status: 401 }
      );
    }

    const user = await User.findOne({ email: userIdentifier });
    const userId = user ? user._id.toString() : 'guest_' + Math.random().toString(36).substring(7);

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    // 1. Configure Dutch payment methods and metadata
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['ideal', 'card', 'bancontact'],
      mode: 'subscription',
      customer_email: user?.email || userIdentifier,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'StudyPlanner Pro (Onbeperkt)',
              description: 'Onbeperkte AI-analyses, geavanceerd toetsrooster en automatische ouderupdates.',
            },
            unit_amount: 499, // €4.99 per maand
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        email: user?.email || userIdentifier,
        parentIdentifier: body.parentEmail || '',
        source: 'studyplanner_nl_checkout',
      },
      subscription_data: {
        metadata: {
          userId,
          email: user?.email || userIdentifier,
        },
      },
      success_url: `${origin}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      locale: 'nl',
    } as any);

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error: any) {
    console.error('Error creating Stripe checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Interne fout bij het aanmaken van de betaalsessie.' },
      { status: 500 }
    );
  }
}
