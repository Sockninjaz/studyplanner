import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    await dbConnect();
    
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      id: user._id,
      name: user.name,
      email: user.email,
      hasPassword: !!user.password,
    });
  } catch (error) {
    console.error('Test user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
