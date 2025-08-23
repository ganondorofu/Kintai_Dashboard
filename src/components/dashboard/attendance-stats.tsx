
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserAttendanceLogsV2, safeTimestampToDate, getWorkdaysInRange } from '@/lib/data-adapter';
import type { AppUser } from '@/types';
import { format, subDays, differenceInMinutes, startOfMonth, isSameDay } from 'date-fns';

interface Stats {
  lastAttendedDate: string | null;
  attendedDaysThisMonth: number;
  totalAttendedDays: number;
  attendanceRate: number;
  averageStayDuration: string;
  totalWorkdaysLast30Days: number;
  attendedDaysLast30Days: number;
}

export function AttendanceStats({ user }: { user: AppUser }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateStats = useCallback(async () => {
    setError(null);
    try {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const startOfCurrentMonth = startOfMonth(now);

      // 過去30日間のログを十分に取得
      const logsLast30Days = await getUserAttendanceLogsV2(user.uid, thirtyDaysAgo, now, 1000);
      // 全期間のログも取得（累計日数計算用）
      const totalLogs = await getUserAttendanceLogsV2(user.uid, new Date(0), now, 9999);
      // 過去30日間の活動日を取得
      const workdaysLast30Days = await getWorkdaysInRange(thirtyDaysAgo, now);
      
      const logsByDate = new Map<string, { checkIn: Date | null, checkOut: Date | null }>();
      
      const processLogs = (logsToProcess: any[]) => {
          logsToProcess.forEach(log => {
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
      }

      processLogs(totalLogs);
      
      const sortedDates = Array.from(logsByDate.keys()).sort((a,b) => b.localeCompare(a));
      
      const lastAttendedDate = sortedDates.length > 0 ? format(new Date(sortedDates[0]), 'yyyy/MM/dd') : null;
      
      const attendedDaysThisMonth = sortedDates.filter(date => new Date(date) >= startOfCurrentMonth).length;
      
      const totalAttendedDays = sortedDates.length;

      const workdaysSet = new Set(workdaysLast30Days.map(d => d.toISOString().split('T')[0]));
      
      const attendedWorkdaysLast30 = sortedDates.filter(date => new Date(date) >= thirtyDaysAgo && workdaysSet.has(date));
      const attendedDaysLast30Days = attendedWorkdaysLast30.length;
      
      const attendanceRate = workdaysLast30Days.length > 0 
        ? (attendedDaysLast30Days / workdaysLast30Days.length) * 100 
        : 0;
      
      let totalStayMinutes = 0;
      let stayCount = 0;
      
      const logsByDateForDuration = new Map<string, { checkIn: Date | null, checkOut: Date | null }>();
      logsLast30Days.forEach(log => {
        const logDate = safeTimestampToDate(log.timestamp);
        if(!logDate) return;
        const dateKey = format(logDate, 'yyyy-MM-dd');
        if (!logsByDateForDuration.has(dateKey)) {
          logsByDateForDuration.set(dateKey, { checkIn: null, checkOut: null });
        }
        const dayData = logsByDateForDuration.get(dateKey)!;
        if (log.type === 'entry') {
          if (!dayData.checkIn || logDate < dayData.checkIn) dayData.checkIn = logDate;
        } else if (log.type === 'exit') {
          if (!dayData.checkOut || logDate > dayData.checkOut) dayData.checkOut = logDate;
        }
      });

      logsByDateForDuration.forEach(dayData => {
        if (dayData.checkIn && dayData.checkOut && dayData.checkOut > dayData.checkIn) {
          totalStayMinutes += differenceInMinutes(dayData.checkOut, dayData.checkIn);
          stayCount++;
        }
      });
      
      const avgMinutes = stayCount > 0 ? totalStayMinutes / stayCount : 0;
      const avgHours = Math.floor(avgMinutes / 60);
      const avgRemainingMinutes = Math.round(avgMinutes % 60);
      const averageStayDuration = `${avgHours}時間${avgRemainingMinutes}分`;

      setStats({
        lastAttendedDate,
        attendedDaysThisMonth,
        totalAttendedDays,
        attendanceRate,
        averageStayDuration,
        totalWorkdaysLast30Days: workdaysLast30Days.length,
        attendedDaysLast30Days,
      });

    } catch (error) {
      console.error('統計データの計算に失敗:', error);
      setError('統計データを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);
  
  if (loading) {
    return (
        <>
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-24 w-full" />
        </>
    );
  }

  if (error) {
      return (
          <Card>
              <CardContent className="pt-6">
                  <p className="text-center text-red-500">{error}</p>
              </CardContent>
          </Card>
      )
  }

  if (!stats) {
       return (
        <Card>
            <CardContent className="pt-6">
                <p className="text-center text-gray-500">統計データがありません。</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <>
      <Card>
          <CardHeader>
              <CardTitle>勤務状況</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">前回出勤日</span>
                  <span className="font-semibold">{stats.lastAttendedDate || '-'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">今月の出勤日数</span>
                  <span className="font-semibold">{stats.attendedDaysThisMonth}日</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">累計出勤日数</span>
                  <span className="font-semibold">{stats.totalAttendedDays}日</span>
              </div>
          </CardContent>
      </Card>
       <Card>
          <CardHeader>
              <CardTitle>勤務統計 (過去30日)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">出勤率 (対活動日)</span>
                  <span className="font-semibold">{stats.attendanceRate.toFixed(1)}% ({stats.attendedDaysLast30Days}/{stats.totalWorkdaysLast30Days}日)</span>
              </div>
               <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">平均滞在時間</span>
                  <span className="font-semibold">{stats.averageStayDuration}</span>
              </div>
          </CardContent>
      </Card>
    </>
  );
}
