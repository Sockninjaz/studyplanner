import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        console.log('=== AUTH DEBUG ===');
        console.log('Authorize function called');
        console.log('Credentials:', credentials?.email ? 'Email provided' : 'No email');
        
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        await dbConnect();
        
        try {
          console.log('Looking for user:', credentials.email);
          const user = await User.findOne({ email: credentials.email }).select('+password');
          
          if (!user) {
            console.log('User not found');
            return null;
          }

          if (!user.password) {
            console.log('User has no password');
            return null;
          }

          console.log('Comparing password...');
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          console.log('Password valid:', isPasswordValid);
          
          if (!isPasswordValid) {
            console.log('Invalid password');
            return null;
          }

          console.log('Authentication successful for:', user.email);
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});

export { handler as GET, handler as POST };
