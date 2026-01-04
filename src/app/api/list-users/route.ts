import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function GET() {
  try {
    await dbConnect();
    
    const users = await User.find({}, { name: 1, email: 1, createdAt: 1 }).sort({ createdAt: -1 });
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
