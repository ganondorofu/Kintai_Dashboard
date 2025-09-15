
import { NextResponse } from 'next/server';
import { forceClockOutAllActiveUsers, getForceClockOutSettings, createApiCallLog, updateApiCallLog } from '@/lib/data-adapter';
import { toZonedTime, format } from 'date-fns-tz';

export const dynamic = 'force-dynamic';

export async function GET() {
  const logId = await createApiCallLog('/api/force-clock-out', { status: 'running' });

  try {
    const settings = await getForceClockOutSettings();
    const startTime = settings?.forceClockOutStartTime || '23:55';
    const endTime = settings?.forceClockOutEndTime || '23:59';

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
      isInRange = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    } else {
      isInRange = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    }
    
    if (!isInRange) {
      const message = `Not in active time range. Current: ${currentTime}, Range: ${startTime}-${endTime}. Skipping.`;
      console.log(`[/api/force-clock-out] ${message}`);
      await updateApiCallLog(logId, { status: 'skipped', result: { message } });
      return NextResponse.json({ message });
    }

    const startMessage = `Received request in active time range. Current: ${currentTime}, Range: ${startTime}-${endTime}. Starting force clock out process...`;
    console.log(`[/api/force-clock-out] ${startMessage}`);
    await updateApiCallLog(logId, { result: { message: startMessage } });

    const result = await forceClockOutAllActiveUsers();
    console.log('[/api/force-clock-out] Process finished:', result);

    const response = {
      message: 'Forced clock out process completed successfully.',
      ...result,
    };
    
    await updateApiCallLog(logId, { status: 'success', result: response });
    return NextResponse.json(response);

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/force-clock-out] An error occurred:', error);
    await updateApiCallLog(logId, { status: 'error', result: { message: 'An error occurred during the force clock out process.', error: errorMessage } });
    return NextResponse.json(
      { message: 'An error occurred during the force clock out process.' },
      { status: 500 }
    );
  }
}
