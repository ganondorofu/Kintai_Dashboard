'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserAttendanceLogsV2, getWorkdaysInRange, getDailyAttendanceStatsV2 } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { Calendar, Clock, TrendingUp, Users } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AttendanceStatsProps {
  user: AppUser;
}

interface DayStats {
  date: Date;
  hasEntry: boolean;
  hasExit: boolean;
  entryTime?: Date;
  exitTime?: Date;
  workingHours?: number;
}

export function AttendanceStats({ user }: AttendanceStatsProps) {
  const [userLogs, setUserLogs] = useState<AttendanceLog[]>([]);
  const [workdays, setWorkdays] = useState<Date[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const thirtyDaysAgo = subDays(new Date(), 30);
  const today = new Date();

  const loadStatsData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedLogs, fetchedWorkdays, fetchedTeamStats] = await Promise.all([
        getUserAttendanceLogsV2(user.uid, thirtyDaysAgo, today, 1000), // 30日分なので十分な数を取得
        getWorkdaysInRange(thirtyDaysAgo, today),
        getDailyAttendanceStatsV2(new Date()),
      ]);
      setUserLogs(fetchedLogs);
      setWorkdays(fetchedWorkdays);
      setTeamStats(fetchedTeamStats);
    } catch (error) {
      console.error('統計データの計算に失敗:', error);
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    loadStatsData();
  }, [loadStatsData]);

  // 月の集計値
  const summary = {
    attendedDays: 0,
    totalHours: 0,
    averageHours: 0
  };

  if(userLogs.length > 0) {
    const attendedDates = new Set<string>();
    const workDurations: number[] = [];
    const logsByDate = new Map<string, AttendanceLog[]>();

    userLogs.forEach(log => {
        const dateKey = format(log.timestamp.toDate(), 'yyyy-MM-dd');
        if (!logsByDate.has(dateKey)) {
            logsByDate.set(dateKey, []);
        }
        logsByDate.get(dateKey)!.push(log);
        attendedDates.add(dateKey);
    });
    
    summary.attendedDays = attendedDates.size;

    logsByDate.forEach((dayLogs) => {
        const entries = dayLogs.filter(l => l.type === 'entry').sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());
        const exits = dayLogs.filter(l => l.type === 'exit').sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());

        if (entries.length > 0 && exits.length > 0) {
            const firstEntry = entries[0].timestamp.toMillis();
            const lastExit = exits[exits.length - 1].timestamp.toMillis();
            if(lastExit > firstEntry) {
                workDurations.push((lastExit - firstEntry) / (1000 * 60 * 60));
            }
        }
    });
    
    summary.totalHours = workDurations.reduce((acc, cur) => acc + cur, 0);
    if(workDurations.length > 0) {
        summary.averageHours = summary.totalHours / workDurations.length;
    }
  }


  // 今月の出席率
  const attendanceRate = workdays.length > 0
    ? (summary.attendedDays / workdays.length) * 100
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-6 h-28 animate-pulse bg-gray-200 rounded-lg"></CardContent></Card>)}
        </div>
        <Card><CardContent className="p-6 h-96 animate-pulse bg-gray-200 rounded-lg"></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">出席日数 (過去30日)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.attendedDays} / {workdays.length} 日
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">出席率 (対活動日)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {attendanceRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">総活動時間</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.totalHours.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">平均活動時間</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.averageHours.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
