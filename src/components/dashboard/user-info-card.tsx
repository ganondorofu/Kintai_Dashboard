
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserAttendanceLogsV2, safeTimestampToDate, getWorkdaysInRange } from '@/lib/data-adapter';
import type { AppUser, Team } from '@/types';
import { format, subDays, differenceInMinutes, startOfMonth } from 'date-fns';
import { Separator } from '@/components/ui/separator';

interface Stats {
  lastAttendedDate: string | null;
  attendedDaysThisMonth: number;
  totalAttendedDays: number;
  attendanceRate: number;
  averageStayDuration: string;
  totalWorkdaysLast30Days: number;
  attendedDaysLast30Days: number;
}

interface UserInfoCardProps {
  user: AppUser;
  allTeams: Team[];
}

export const UserInfoCard: React.FC<UserInfoCardProps> = ({ user, allTeams }) => {
  const [teamName, setTeamName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateStats = async () => {
      setError(null);
      try {
        const now = new Date();
        const thirtyDaysAgo = subDays(now, 30);
        const startOfCurrentMonth = startOfMonth(now);
  
        const logsLast30Days = await getUserAttendanceLogsV2(user.uid, thirtyDaysAgo, now, 1000);
        const totalLogs = await getUserAttendanceLogsV2(user.uid, new Date(0), now, 9999);
        const workdaysLast30Days = await getWorkdaysInRange(thirtyDaysAgo, now);
  
        const logsByDate = new Map<string, { checkIn: Date | null, checkOut: Date | null }>();
        
        totalLogs.forEach(log => {
          const logDate = safeTimestampToDate(log.timestamp);
          if (!logDate) return;
          const dateKey = format(logDate, 'yyyy-MM-dd');
          if (!logsByDate.has(dateKey)) {
            logsByDate.set(dateKey, { checkIn: null, checkOut: null });
          }
          const dayData = logsByDate.get(dateKey)!;
          if (log.type === 'entry' && (!dayData.checkIn || logDate < dayData.checkIn)) {
            dayData.checkIn = logDate;
          } else if (log.type === 'exit' && (!dayData.checkOut || logDate > dayData.checkOut)) {
            dayData.checkOut = logDate;
          }
        });
  
        const sortedDates = Array.from(logsByDate.keys()).sort((a,b) => b.localeCompare(a));
        const lastAttendedDate = sortedDates.length > 0 ? format(new Date(sortedDates[0]), 'yyyy/MM/dd') : null;
        const attendedDaysThisMonth = sortedDates.filter(date => new Date(date) >= startOfCurrentMonth).length;
        const totalAttendedDays = sortedDates.length;
  
        const workdaysSet = new Set(workdaysLast30Days.map(d => d.toISOString().split('T')[0]));
        const attendedWorkdaysLast30 = sortedDates.filter(date => new Date(date) >= thirtyDaysAgo && workdaysSet.has(date));
        const attendedDaysLast30Days = attendedWorkdaysLast30.length;
        const attendanceRate = workdaysLast30Days.length > 0 ? (attendedDaysLast30Days / workdaysLast30Days.length) * 100 : 0;
  
        let totalStayMinutes = 0;
        let stayCount = 0;
        logsByDate.forEach((dayData, dateKey) => {
            if (new Date(dateKey) >= thirtyDaysAgo) {
                if (dayData.checkIn && dayData.checkOut && dayData.checkOut > dayData.checkIn) {
                    totalStayMinutes += differenceInMinutes(dayData.checkOut, dayData.checkIn);
                    stayCount++;
                }
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
  
      } catch (e) {
        console.error('統計データの計算に失敗:', e);
        setError('統計データを読み込めませんでした。');
      } finally {
        setLoading(false);
      }
    };
    
    if (user.teamId && allTeams.length > 0) {
      const team = allTeams.find(t => t.id === user.teamId);
      setTeamName(team?.name || user.teamId);
    } else {
      setTeamName('未所属');
    }

    calculateStats();
  }, [user.uid, user.teamId, allTeams]);

  const teamNameToDisplay = loading ? '読み込み中...' : (teamName || '未所属');
  
  const StatItem = ({ label, value }: { label: string, value: React.ReactNode }) => (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザー情報</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <StatItem label="名前" value={`${user.lastname} ${user.firstname}`} />
          <StatItem label="所属班" value={teamNameToDisplay} />
        </div>
        
        <Separator className="my-4" />
        
        <h4 className="text-md font-semibold mb-3">勤務状況</h4>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : stats ? (
          <div className="space-y-3">
            <StatItem label="前回出勤日" value={stats.lastAttendedDate || '-'} />
            <StatItem label="今月の出勤日数" value={`${stats.attendedDaysThisMonth}日`} />
            <StatItem label="累計出勤日数" value={`${stats.totalAttendedDays}日`} />
          </div>
        ) : (
           <p className="text-sm text-gray-500">データがありません</p>
        )}

        <Separator className="my-4" />

        <h4 className="text-md font-semibold mb-3">勤務統計 (過去30日)</h4>
         {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : stats ? (
          <div className="space-y-3">
            <StatItem 
              label="出勤率 (対活動日)" 
              value={`${stats.attendanceRate.toFixed(1)}% (${stats.attendedDaysLast30Days}/${stats.totalWorkdaysLast30Days}日)`} 
            />
            <StatItem label="平均滞在時間" value={stats.averageStayDuration} />
          </div>
        ) : (
           <p className="text-sm text-gray-500">データがありません</p>
        )}

      </CardContent>
    </Card>
  );
};
