
'use client';

import { useState, useEffect } from 'react';
import { AttendanceLogs } from './attendance-logs';
import type { AppUser, Team } from '@/types';
import { UserInfoCard } from './user-info-card';
import { AttendanceStats, type Stats } from './attendance-stats';
import { useDashboard } from '@/contexts/dashboard-context';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserAttendanceLogsV2, getWorkdaysInRange, safeTimestampToDate } from '@/lib/data-adapter';
import { format, subDays, differenceInMinutes, startOfMonth } from 'date-fns';

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const { allTeams, isLoading: isDashboardLoading } = useDashboard();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStatsAndTeam = async () => {
      setLoadingStats(true);
      
      // チーム名の設定
      if (user.teamId && allTeams.length > 0) {
        const team = allTeams.find(t => t.id === user.teamId);
        setTeamName(team?.name || user.teamId);
      } else {
        setTeamName('未所属');
      }

      // 統計情報の計算
      try {
        const now = new Date();
        const thirtyDaysAgo = subDays(now, 30);
        const startOfCurrentMonth = startOfMonth(now);

        const logs = await getUserAttendanceLogsV2(user.uid, thirtyDaysAgo, now, 1000);
        const workdaysLast30Days = await getWorkdaysInRange(thirtyDaysAgo, now);

        const logsByDate = new Map<string, { checkIn: Date | null, checkOut: Date | null }>();
        
        logs.forEach(log => {
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
        
        const totalLogs = await getUserAttendanceLogsV2(user.uid, new Date(0), now, 9999);
        const totalAttendedDays = new Set(totalLogs.map(l => {
          const d = safeTimestampToDate(l.timestamp);
          return d ? format(d, 'yyyy-MM-dd') : null;
        }).filter(Boolean)).size;
  
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

        const checkInTimes = Array.from(logsByDate.values())
          .map(d => d.checkIn)
          .filter((d): d is Date => d !== null && new Date(d) >= thirtyDaysAgo);
        
        let averageCheckInTime = '--:--';
        if (checkInTimes.length > 0) {
          const avgTimeInMs = checkInTimes.reduce((sum, time) => {
            return sum + (time.getHours() * 60 + time.getMinutes());
          }, 0) / checkInTimes.length;
          
          const hours = Math.floor(avgTimeInMs / 60);
          const minutes = Math.round(avgTimeInMs % 60);
          averageCheckInTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        const totalWorkHours = totalStayMinutes / 60;
  
        setStats({
          lastAttendedDate,
          attendedDaysThisMonth,
          totalAttendedDays,
          attendanceRate,
          averageStayDuration,
          totalWorkdaysLast30Days: workdaysLast30Days.length,
          attendedDaysLast30Days,
          averageCheckInTime,
          totalWorkHours: parseFloat(totalWorkHours.toFixed(1))
        });
      } catch (e) {
        console.error('統計データの計算に失敗:', e);
      } finally {
        setLoadingStats(false);
      }
    };
    
    if (!isDashboardLoading) {
        fetchStatsAndTeam();
    }
  }, [user.uid, allTeams, isDashboardLoading]);

  if (isDashboardLoading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Skeleton className="h-96" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          個人ダッシュボード
        </h1>
        <p className="text-gray-600">
          こんにちは、{user.lastname} {user.firstname}さん！あなたの個人ダッシュボードです。
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <UserInfoCard user={user} teamName={teamName} />
          <AttendanceStats stats={stats} loading={loadingStats} />
        </div>

        <div className="lg:col-span-2">
          <AttendanceLogs user={user} />
        </div>
      </div>
    </div>
  );
}
