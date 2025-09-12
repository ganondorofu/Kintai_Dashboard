import { NextResponse } from 'next/server';
import { forceClockOutAllActiveUsers } from '@/lib/data-adapter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[/api/force-clock-out] Received request, starting force clock out process...');
    const result = await forceClockOutAllActiveUsers();
    console.log('[/api/force-clock-out] Process finished:', result);
    return NextResponse.json({
      message: 'Forced clock out process completed successfully.',
      ...result,
    });
  } catch (error) {
    console.error('[/api/force-clock-out] An error occurred:', error);
    return NextResponse.json(
      { message: 'An error occurred during the force clock out process.' },
      { status: 500 }
    );
  }
}
