import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import BlockedDay from '@/models/BlockedDay';
import User from '@/models/User';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const blockedDays = await BlockedDay.find({ user: user._id });
    const dates = blockedDays.map(bd => bd.date.toISOString().split('T')[0]);

    return NextResponse.json({ data: dates });
  } catch (error) {
    console.error('Error fetching blocked days:', error);
    return NextResponse.json({ error: 'Failed to fetch blocked days' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { date } = await request.json();
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const dateUTC = new Date(date + 'T00:00:00.000Z');

    const existing = await BlockedDay.findOne({ user: user._id, date: dateUTC });
    if (existing) {
      return NextResponse.json({ error: 'Day is already blocked' }, { status: 409 });
    }

    await BlockedDay.create({ user: user._id, date: dateUTC });

    return NextResponse.json({ data: { date, blocked: true } });
  } catch (error) {
    console.error('Error blocking day:', error);
    return NextResponse.json({ error: 'Failed to block day' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  try {
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { date } = await request.json();
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const dateUTC = new Date(date + 'T00:00:00.000Z');

    await BlockedDay.deleteOne({ user: user._id, date: dateUTC });

    return NextResponse.json({ data: { date, blocked: false } });
  } catch (error) {
    console.error('Error unblocking day:', error);
    return NextResponse.json({ error: 'Failed to unblock day' }, { status: 500 });
  }
}
