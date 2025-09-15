
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AttendanceLogs } from './attendance-logs';
import type { AppUser, Team, Notification } from '@/types';
import { UserInfoCard } from './user-info-card';
import { useDashboard } from '@/contexts/dashboard-context';
import { Skeleton } from '@/components/ui/skeleton';
import { getUserAttendanceLogsV2, getWorkdaysInRange, safeTimestampToDate, getNotifications } from '@/lib/data-adapter';
import { format, subDays, differenceInMinutes, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Bell, Info, Megaphone } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface Stats {
  attendanceRate: number;
  attendedDaysLast30Days: number;
  totalWorkdaysLast30Days: number;
  totalWorkHours: number;
}

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(5);
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  if (loading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {notifications.map(n => {
        const Icon = n.level === 'important' ? Megaphone : n.level === 'warning' ? AlertCircle : Bell;
        const cardClass = cn("border-l-4", {
          "border-red-500 bg-red-50": n.level === 'important',
          "border-yellow-500 bg-yellow-50": n.level === 'warning',
          "border-blue-500 bg-blue-50": n.level === 'info',
        });
        const iconClass = cn({
          "text-red-600": n.level === 'important',
          "text-yellow-600": n.level === 'warning',
          "text-blue-600": n.level === 'info',
        });

        return (
          <Card key={n.id} className={cardClass}>
            <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
              <Icon className={cn("h-6 w-6", iconClass)} />
              <CardTitle className="text-lg">{n.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-muted-foreground mt-4">
                {safeTimestampToDate(n.createdAt)?.toLocaleString('ja-JP')}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}


const StatItem = ({ label, value, subtext }: { label: string, value: React.ReactNode, subtext?: string }) => (
    <div className="flex justify-between items-center text-sm">
      <div>
        <span className="text-muted-foreground">{label}</span>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
      </div>
      <span className="font-semibold text-lg">{value}</span>
    </div>
  );

export default function UserDashboard({ user }: { user: AppUser }) {
  const { allTeams, isLoading: isDashboardLoading } = useDashboard();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStatsAndTeam = async () => {
      setLoadingStats(true);
      
      if (user.teamId && allTeams.length > 0) {
        const team = allTeams.find(t => t.id === user.teamId);
        setTeamName(team?.name || user.teamId);
      } else {
        setTeamName('未所属');
      }

      try {
        const now = new Date();
        const thirtyDaysAgo = subDays(now, 30);

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
        
        const workdaysSet = new Set(workdaysLast30Days.map(d => d.toISOString().split('T')[0]));
        const attendedWorkdaysLast30 = sortedDates.filter(date => new Date(date) >= thirtyDaysAgo && workdaysSet.has(date));
        const attendedDaysLast30Days = attendedWorkdaysLast30.length;
        const attendanceRate = workdaysLast30Days.length > 0 ? (attendedDaysLast30Days / workdaysLast30Days.length) * 100 : 0;
  
        let totalStayMinutes = 0;
        Array.from(logsByDate.values()).forEach((dayData) => {
            if (dayData.checkIn && dayData.checkOut && dayData.checkOut > dayData.checkIn) {
                totalStayMinutes += differenceInMinutes(dayData.checkOut, dayData.checkIn);
            }
        });
  
        const totalWorkHours = totalStayMinutes / 60;
  
        setStats({
          attendanceRate,
          attendedDaysLast30Days,
          totalWorkdaysLast30Days: workdaysLast30Days.length,
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
      <Notifications />

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
          {loadingStats ? (
             <Card>
                <CardHeader><CardTitle>勤務統計 (過去30日)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </CardContent>
            </Card>
          ) : stats ? (
             <Card>
                <CardHeader><CardTitle>勤務統計 (過去30日)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <StatItem 
                        label="出勤率"
                        subtext="対活動日"
                        value={`${stats.attendanceRate.toFixed(0)}%`}
                    />
                     <StatItem 
                        label="出勤日数"
                        subtext={`${stats.totalWorkdaysLast30Days}活動日中`}
                        value={`${stats.attendedDaysLast30Days}日`}
                    />
                    <StatItem 
                      label="総労働時間" 
                      subtext="過去30日間"
                      value={`${stats.totalWorkHours}h`} 
                    />
                </CardContent>
            </Card>
          ) : (
             <Card>
                <CardHeader><CardTitle>勤務統計 (過去30日)</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-center text-gray-500">統計データを読み込めませんでした。</p>
                </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <AttendanceLogs user={user} />
        </div>
      </div>
    </div>
  );
}
