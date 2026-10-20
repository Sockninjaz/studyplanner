import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
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
          const user = await User.findOne({ email: credentials.email }).select('+password');
          if (!user || !user.password) return null;
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) return null;
          return { id: user._id.toString(), email: user.email, name: user.name };
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
};
