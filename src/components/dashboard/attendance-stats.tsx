
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserAttendanceLogsV2, getWorkdaysInRange, safeTimestampToDate } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { Calendar, Clock, TrendingUp, History } from 'lucide-react';
import { format, subDays, differenceInMinutes, startOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AttendanceStatsProps {
  user: AppUser;
}

export function AttendanceStats({ user }: AttendanceStatsProps) {
  const [stats, setStats] = useState({
    attendedDays: 0,
    totalWorkdays: 0,
    attendanceRate: 0,
    averageCheckInTime: '--:--',
    totalWorkHours: 0,
  });
  const [loading, setLoading] = useState(true);

  const calculateStats = useCallback(async () => {
    setLoading(true);
    try {
        const now = new Date();
        const thirtyDaysAgo = subDays(now, 30);
        
        const [thirtyDayLogs, workdays] = await Promise.all([
          getUserAttendanceLogsV2(user.uid, thirtyDaysAgo, now, 1000),
          getWorkdaysInRange(thirtyDaysAgo, now)
        ]);
        const totalWorkdays = workdays.length;
        const workdaysSet = new Set(workdays.map(d => d.toISOString().split('T')[0]));

        const logsByDate = new Map<string, { checkIn: Date | null, checkOut: Date | null }>();

        thirtyDayLogs.forEach(log => {
          const logDate = safeTimestampToDate(log.timestamp);
          if (!logDate) return;
          const dateKey = format(logDate, 'yyyy-MM-dd');
          
          if (!logsByDate.has(dateKey)) {
            logsByDate.set(dateKey, { checkIn: null, checkOut: null });
          }

          const dayData = logsByDate.get(dateKey)!;

          if (log.type === 'entry') {
            if (!dayData.checkIn || logDate < dayData.checkIn) {
              dayData.checkIn = logDate;
            }
          } else if (log.type === 'exit') {
            if (!dayData.checkOut || logDate > dayData.checkOut) {
              dayData.checkOut = logDate;
            }
          }
        });

        const attendedDays = Array.from(logsByDate.keys()).filter(dateKey => workdaysSet.has(dateKey) && logsByDate.get(dateKey)?.checkIn).length;
        const attendanceRate = totalWorkdays > 0 ? (attendedDays / totalWorkdays) * 100 : 0;
        
        let totalMinutes = 0;
        const checkInTimes: number[] = [];

        logsByDate.forEach((dayData) => {
          if (dayData.checkIn && dayData.checkOut && dayData.checkOut > dayData.checkIn) {
            totalMinutes += differenceInMinutes(dayData.checkOut, dayData.checkIn);
          }
          if (dayData.checkIn) {
            checkInTimes.push(dayData.checkIn.getHours() * 60 + dayData.checkIn.getMinutes());
          }
        });
        
        const totalWorkHours = totalMinutes > 0 ? Math.floor(totalMinutes / 60) : 0;
        
        let averageCheckInTime = '--:--';
        if (checkInTimes.length > 0) {
            const avgTimeInMs = checkInTimes.reduce((sum, time) => sum + time, 0) / checkInTimes.length;
            const hours = Math.floor(avgTimeInMs / 60);
            const minutes = Math.round(avgTimeInMs % 60);
            averageCheckInTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        setStats({
            attendedDays,
            totalWorkdays,
            attendanceRate,
            averageCheckInTime,
            totalWorkHours,
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
  
  if (loading) {
    return (
        <Card>
            <CardContent className="h-96 animate-pulse bg-gray-100 rounded-lg p-6" />
        </Card>
    );
  }

  return (
    <Card>
        <CardHeader><CardTitle>勤務統計</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">出勤率 (対活動日)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.attendanceRate.toFixed(0)}%</div>
                    <p className="text-xs text-muted-foreground">過去30日間</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">出勤日数</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.attendedDays}日</div>
                    <p className="text-xs text-muted-foreground">{stats.totalWorkdays}活動日中</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">平均チェックイン</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.averageCheckInTime}</div>
                    <p className="text-xs text-muted-foreground">過去30日間の平均</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">総労働時間</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalWorkHours}h</div>
                    <p className="text-xs text-muted-foreground">過去30日間</p>
                </CardContent>
            </Card>
        </CardContent>
    </Card>
  );
}
