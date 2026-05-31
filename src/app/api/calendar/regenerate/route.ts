import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { regenerateSchedule } from '@/lib/scheduling/regenerateSchedule';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await dbConnect();
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const result = await regenerateSchedule(user);

        return NextResponse.json({
            message: result.message || 'Schedule regenerated successfully',
            overloadWarning: result.overloadWarning,
            overloadedDays: result.overloadedDays
        }, { status: 200 });

    } catch (error) {
        console.error('Error regenerating schedule:', error);
        return NextResponse.json({ error: 'Error regenerating schedule' }, { status: 500 });
    }
}
