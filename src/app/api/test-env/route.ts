import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    mongodbUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
    envLocal: 'Checking .env.local',
  });
}
