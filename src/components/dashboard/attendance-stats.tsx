
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserAttendanceLogsV2, getWorkdaysInRange, safeTimestampToDate } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { Calendar, Clock, TrendingUp, History } from 'lucide-react';
import { format, subDays, differenceInMinutes, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AttendanceStatsProps {
  user: AppUser;
}

export function AttendanceStats({ user }: AttendanceStatsProps) {
  const [stats, setStats] = useState({
    lastCheckInDate: '-',
    monthlyAttendance: 0,
    totalAttendance: 0,
    attendanceRate: 0,
    averageWorkMinutes: 0,
  });
  const [loading, setLoading] = useState(true);

  const calculateStats = useCallback(async () => {
    setLoading(true);
    try {
        const now = new Date();
        const thirtyDaysAgo = subDays(now, 30);
        const currentMonthStart = startOfMonth(now);
        
        const [allTimeLogs, thirtyDayLogs, workdays] = await Promise.all([
          getUserAttendanceLogsV2(user.uid, undefined, undefined, 9999),
          getUserAttendanceLogsV2(user.uid, thirtyDaysAgo, now, 1000),
          getWorkdaysInRange(thirtyDaysAgo, now)
        ]);

        const allTimeDates = new Set(allTimeLogs.filter(log => log.type === 'entry').map(log => format(safeTimestampToDate(log.timestamp)!, 'yyyy-MM-dd')));

        const thirtyDayDates = new Set(thirtyDayLogs.filter(log => log.type === 'entry').map(log => format(safeTimestampToDate(log.timestamp)!, 'yyyy-MM-dd')));

        const monthlyLogs = allTimeLogs.filter(log => {
            const logDate = safeTimestampToDate(log.timestamp);
            return logDate && logDate >= currentMonthStart && logDate <= now;
        });
        const monthlyDates = new Set(monthlyLogs.filter(log => log.type === 'entry').map(log => format(safeTimestampToDate(log.timestamp)!, 'yyyy-MM-dd')));

        const workDurations: number[] = [];
        const logsByDate = new Map<string, AttendanceLog[]>();
        thirtyDayLogs.forEach(log => {
            const dateKey = format(safeTimestampToDate(log.timestamp)!, 'yyyy-MM-dd');
            if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, []);
            logsByDate.get(dateKey)!.push(log);
        });

        logsByDate.forEach(dayLogs => {
            const entries = dayLogs.filter(l => l.type === 'entry').map(l => safeTimestampToDate(l.timestamp)!).sort((a,b) => a.getTime() - b.getTime());
            const exits = dayLogs.filter(l => l.type === 'exit').map(l => safeTimestampToDate(l.timestamp)!).sort((a,b) => a.getTime() - b.getTime());
            if (entries.length > 0 && exits.length > 0) {
                const duration = differenceInMinutes(exits[exits.length - 1], entries[0]);
                if (duration > 0) workDurations.push(duration);
            }
        });

        const totalMinutes = workDurations.reduce((acc, cur) => acc + cur, 0);
        const averageWorkMinutes = workDurations.length > 0 ? totalMinutes / workDurations.length : 0;
        const attendanceRate = workdays.length > 0 ? (thirtyDayDates.size / workdays.length) * 100 : 0;
        const lastCheckInDate = allTimeDates.size > 0 ? format(new Date(Math.max(...Array.from(allTimeDates).map(d => new Date(d).getTime()))), 'yyyy/MM/dd') : '-';

        setStats({
            lastCheckInDate,
            monthlyAttendance: monthlyDates.size,
            totalAttendance: allTimeDates.size,
            attendanceRate,
            averageWorkMinutes,
        });

    } catch (error) {
      console.error('統計データの計算に失敗:', error);
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '0時間0分';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}時間${m}分`;
  }

  if (loading) {
    return (
        <Card>
            <CardHeader><CardTitle>勤務状況</CardTitle></CardHeader>
            <CardContent className="h-64 animate-pulse bg-gray-100 rounded-b-lg" />
        </Card>
    );
  }

  return (
    <div className='space-y-6'>
        <Card>
            <CardHeader><CardTitle>勤務状況</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <div className='flex justify-between items-center text-sm'>
                    <span className='text-muted-foreground'>前回出勤日</span>
                    <span className='font-semibold'>{stats.lastCheckInDate}</span>
                </div>
                <div className='flex justify-between items-center text-sm'>
                    <span className='text-muted-foreground'>今月の出勤日数</span>
                    <span className='font-semibold'>{stats.monthlyAttendance}日</span>
                </div>
                <div className='flex justify-between items-center text-sm'>
                    <span className='text-muted-foreground'>累計出勤日数</span>
                    <span className='font-semibold'>{stats.totalAttendance}日</span>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>勤務統計 (過去30日)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <div className='flex justify-between items-center text-sm'>
                    <span className='text-muted-foreground'>出勤率 (対活動日)</span>
                    <span className='font-semibold'>{stats.attendanceRate.toFixed(1)}%</span>
                </div>
                <div className='flex justify-between items-center text-sm'>
                    <span className='text-muted-foreground'>平均勤務時間</span>
                    <span className='font-semibold'>{formatDuration(stats.averageWorkMinutes)}</span>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
