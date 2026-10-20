import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { Resend } from 'resend';

// Make sure to add RESEND_API_KEY to .env.local
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findOne({ email });

    if (!user) {
      // Don't leak whether the email exists, just return success
      return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' }, { status: 200 });
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Token expires in 1 hour
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // Create the reset URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send the email
    try {
      await resend.emails.send({
        from: 'StudyPlanner <noreply@resend.dev>', // Update with a verified domain in production
        to: user.email,
        subject: 'Reset your password for StudyPlanner',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>You requested a password reset for your StudyPlanner account.</p>
            <p>Click the button below to set a new password. This link is valid for 1 hour.</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // In development without a key, we might just log the URL
      console.log('Reset URL (for dev):', resetUrl);
    }

    return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' }, { status: 200 });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
