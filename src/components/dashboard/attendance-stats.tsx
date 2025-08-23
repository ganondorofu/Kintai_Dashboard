
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export interface Stats {
  lastAttendedDate: string | null;
  attendedDaysThisMonth: number;
  totalAttendedDays: number;
  attendanceRate: number;
  averageStayDuration: string;
  totalWorkdaysLast30Days: number;
  attendedDaysLast30Days: number;
  averageCheckInTime: string;
  totalWorkHours: number;
}

interface AttendanceStatsProps {
  stats: Stats | null;
  loading: boolean;
}

const StatItem = ({ label, value, loading }: { label: string, value: React.ReactNode, loading?: boolean }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-muted-foreground">{label}</span>
    {loading ? <Skeleton className="h-5 w-24" /> : <span className="font-semibold">{value}</span>}
  </div>
);

export const AttendanceStats: React.FC<AttendanceStatsProps> = ({ stats, loading }) => {
    if (loading) {
        return (
            <>
                <Card>
                    <CardHeader><CardTitle>勤務状況</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>勤務統計 (過去30日)</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        <Skeleton className="h-28 w-full" />
                    </CardContent>
                </Card>
            </>
        )
    }

    if (!stats) {
        return (
             <Card>
                <CardHeader><CardTitle>統計情報</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-center text-gray-500">統計データを読み込めませんでした。</p>
                </CardContent>
            </Card>
        )
    }

  return (
    <>
        <Card>
            <CardHeader>
                <CardTitle>勤務状況</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <StatItem label="前回出勤日" value={stats.lastAttendedDate || '-'} />
                    <StatItem label="今月の出勤日数" value={`${stats.attendedDaysThisMonth}日`} />
                    <StatItem label="累計出勤日数" value={`${stats.totalAttendedDays}日`} />
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>勤務統計 (過去30日)</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="space-y-3">
                    <StatItem 
                        label="出勤率 (対活動日)" 
                        value={`${stats.attendanceRate.toFixed(1)}% (${stats.attendedDaysLast30Days}/${stats.totalWorkdaysLast30Days}日)`}
                    />
                    <StatItem label="平均滞在時間" value={stats.averageStayDuration} />
                    <StatItem label="平均チェックイン" value={stats.averageCheckInTime} />
                    <StatItem label="総労働時間" value={`${stats.totalWorkHours}h`} />
                </div>
            </CardContent>
        </Card>
    </>
  );
};
