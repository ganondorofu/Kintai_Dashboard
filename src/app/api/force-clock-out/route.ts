
import { NextResponse } from 'next/server';
import { forceClockOutAllActiveUsers, getForceClockOutSettings } from '@/lib/data-adapter';
import { toZonedTime, format } from 'date-fns-tz';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getForceClockOutSettings();
    const startTime = settings?.forceClockOutStartTime || '23:55'; // デフォルト23:55
    const endTime = settings?.forceClockOutEndTime || '23:59';   // デフォルト23:59

    const now = new Date();
    const jstNow = toZonedTime(now, 'Asia/Tokyo');
    const currentTime = format(jstNow, 'HH:mm');

    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;

    let isInRange = false;
    if (startTimeInMinutes <= endTimeInMinutes) {
      // 日をまたがない場合 (例: 09:00 - 17:00)
      isInRange = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    } else {
      // 日をまたぐ場合 (例: 23:00 - 02:00)
      isInRange = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    }
    
    if (!isInRange) {
      console.log(`[/api/force-clock-out] Not in active time range. Current: ${currentTime}, Range: ${startTime}-${endTime}. Skipping.`);
      return NextResponse.json({
        message: 'Not in active time range. Skipping.',
      });
    }

    console.log(`[/api/force-clock-out] Received request in active time range. Current: ${currentTime}, Range: ${startTime}-${endTime}. Starting force clock out process...`);
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
