import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim();

    await dbConnect();

    const user = await User.findOne({
      $or: [
        { email: cleanEmail.toLowerCase() },
        { email: cleanEmail },
        { email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ]
    });

    if (!user) {
      // Don't leak whether the email exists, just return success
      return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' }, { status: 200 });
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Token expires in 2 hours
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await user.save();

    // Create the reset URL with Vercel / NEXTAUTH_URL fallback
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    console.log(`[Auth] Password reset requested for ${user.email}. Reset URL: ${resetUrl}`);

    // Send the email if Resend is configured
    if (resend) {
      try {
        const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'StudyPlanner <onboarding@resend.dev>';
        const response = await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: 'Reset your password for StudyPlanner',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e293b;">Reset Your Password</h2>
              <p style="color: #475569; font-size: 16px;">You requested a password reset for your StudyPlanner account.</p>
              <p style="color: #475569; font-size: 16px;">Click the button below to set a new password. This link is valid for 2 hours.</p>
              <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">Reset Password</a>
              <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `
        });

        if (response.error) {
          console.error('[Auth] Resend email delivery failed:', response.error);
        } else {
          console.log('[Auth] Password reset email sent successfully via Resend to:', user.email);
        }
      } catch (emailError) {
        console.error('[Auth] Error sending reset email:', emailError);
      }
    } else {
      console.warn('[Auth] RESEND_API_KEY is not configured. Reset link generated:', resetUrl);
    }

    return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' }, { status: 200 });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
