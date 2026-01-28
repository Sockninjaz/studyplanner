import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function POST() {
  try {
    await dbConnect();
    
    // Drop the exams collection to clear the old schema
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropCollection('exams');
    }
    
    return NextResponse.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 26) {
      // Collection doesn't exist, which is fine
      return NextResponse.json({ message: 'Cache cleared (no collection to drop)' });
    }
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
