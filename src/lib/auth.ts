import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';

// Ensure NEXTAUTH_URL and NEXTAUTH_SECRET fallback automatically on Vercel
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes('localhost')) {
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    } else if (process.env.VERCEL_URL) {
      process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
    } else {
      process.env.NEXTAUTH_URL = 'https://studyplanner-orpin.vercel.app';
    }
  }
}

const authSecret =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  'a8f5b6e3c1d9a7b0c2e8f3d6a9c1b4e7f0a2d8c4b6e9a1d0c3f7b2e5a9d1c8e3';

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = authSecret;
}

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const useSecureCookies = isProduction;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        await dbConnect();
        try {
          const cleanEmail = credentials.email.trim();
          const user = await User.findOne({
            $or: [
              { email: cleanEmail.toLowerCase() },
              { email: cleanEmail },
              { email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
            ]
          }).select('+password');
          if (!user || !user.password) return null;
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) return null;
          return { id: user._id.toString(), email: user.email, name: user.name };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
};
