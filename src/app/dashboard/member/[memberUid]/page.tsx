
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Calendar, Clock, TrendingUp, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAllUsers, getUserAttendanceLogsV2, getWorkdaysInRange, safeTimestampToDate } from '@/lib/data-adapter';
import { convertToJapaneseGrade } from '@/lib/utils';
import type { User as UserType, AttendanceLog } from '@/types';
import { subDays, differenceInMinutes } from 'date-fns';

interface MemberStats {
  user: UserType;
  totalWorkdays: number;
  attendedDays: number;
  attendanceRate: number;
  recentAttendance: any[]; // Changed to any to match processed data
  averageCheckInTime: string;
  totalWorkHours: number;
}

const logsToRecords = (logs: AttendanceLog[]): any[] => {
  const logsByDate: { [date: string]: { checkIn?: Date, checkOut?: Date } } = {};

  logs.forEach(log => {
    const timestamp = safeTimestampToDate(log.timestamp);
    if (!timestamp) return;

    const dateStr = timestamp.toISOString().split('T')[0];

    if (!logsByDate[dateStr]) {
      logsByDate[dateStr] = {};
    }

    if (log.type === 'entry') {
      if (!logsByDate[dateStr].checkIn || timestamp < logsByDate[dateStr].checkIn!) {
        logsByDate[dateStr].checkIn = timestamp;
      }
    } else {
      if (!logsByDate[dateStr].checkOut || timestamp > logsByDate[dateStr].checkOut!) {
        logsByDate[dateStr].checkOut = timestamp;
      }
    }
  });

  return Object.entries(logsByDate).map(([date, record]) => ({
    date,
    checkInTime: record.checkIn?.toISOString(),
    checkOutTime: record.checkOut?.toISOString(),
  })).sort((a, b) => b.date.localeCompare(a.date));
};


export default function MemberStatsPage() {
  const params = useParams();
  const router = useRouter();
  const memberUid = params.memberUid as string;
  
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberStats = async () => {
      try {
        const users = await getAllUsers();
        const member = users.find(user => user.uid === memberUid);

        if (!member) {
          setMemberStats(null);
          setLoading(false);
          return;
        }

        const thirtyDaysAgo = subDays(new Date(), 30);
        const workdays = await getWorkdaysInRange(thirtyDaysAgo, new Date());
        const totalWorkdays = workdays.length;
        const workdaysSet = new Set(workdays.map(d => d.toISOString().split('T')[0]));
        
        const attendanceLogs = await getUserAttendanceLogsV2(member.uid, thirtyDaysAgo, new Date(), 100);
        const attendanceRecords = logsToRecords(attendanceLogs);
        
        const attendedDays = attendanceRecords.filter(record => record.checkInTime && workdaysSet.has(record.date)).length;
        const attendanceRate = totalWorkdays > 0 ? Math.round((attendedDays / totalWorkdays) * 100) : 0;

        // 平均チェックイン時間を計算
        const checkInTimes = attendanceRecords
          .filter(record => record.checkInTime)
          .map(record => new Date(record.checkInTime));
        
        let averageCheckInTime = '--:--';
        if (checkInTimes.length > 0) {
          const avgTimeInMs = checkInTimes.reduce((sum, time) => {
            return sum + (time.getHours() * 60 + time.getMinutes());
          }, 0) / checkInTimes.length;
          
          const hours = Math.floor(avgTimeInMs / 60);
          const minutes = Math.round(avgTimeInMs % 60);
          averageCheckInTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        // 総労働時間を計算
        let totalStayMinutes = 0;
        attendanceRecords.forEach(record => {
            if (record.checkInTime && record.checkOutTime) {
                const checkIn = new Date(record.checkInTime);
                const checkOut = new Date(record.checkOutTime);
                if (checkOut > checkIn) {
                    totalStayMinutes += differenceInMinutes(checkOut, checkIn);
                }
            }
        });
        const totalWorkHours = totalStayMinutes / 60;


        setMemberStats({
          user: member,
          totalWorkdays,
          attendedDays,
          attendanceRate,
          recentAttendance: attendanceRecords.slice(0, 10), // 最新10件
          averageCheckInTime,
          totalWorkHours: parseFloat(totalWorkHours.toFixed(1))
        });
      } catch (error) {
        console.error('Failed to fetch member stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (memberUid) {
      fetchMemberStats();
    }
  }, [memberUid]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <div className="text-lg text-gray-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!memberStats) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <div className="text-lg text-gray-500">メンバーが見つかりませんでした</div>
        </div>
      </div>
    );
  }

  const { user, totalWorkdays, attendedDays, attendanceRate, recentAttendance, averageCheckInTime, totalWorkHours } = memberStats;

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-lg font-medium text-gray-700">
              {user.lastname?.[0]}{user.firstname?.[0]}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user.lastname} {user.firstname}
            </h1>
            <p className="text-gray-600">
              {convertToJapaneseGrade(user.grade)} | {user.github}
            </p>
          </div>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">出勤率 (対活動日)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">過去30日間</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">出勤日数</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendedDays}日</div>
            <p className="text-xs text-muted-foreground">{totalWorkdays}活動日中</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均チェックイン</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCheckInTime}</div>
            <p className="text-xs text-muted-foreground">過去30日間の平均</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総労働時間</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWorkHours}h</div>
            <p className="text-xs text-muted-foreground">過去30日間</p>
          </CardContent>
        </Card>
      </div>

      {/* 最近の出勤記録 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            最近の出勤記録
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 実際の出勤記録を表示 */}
            {memberStats.recentAttendance.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                出勤記録がありません
              </div>
            ) : (
              memberStats.recentAttendance.map((record: any, index: number) => {
                const date = new Date(record.date);
                const isPresent = record.checkInTime !== undefined;
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {date.toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isPresent ? (
                        <>
                          <Badge variant="default">出勤</Badge>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(record.checkInTime).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          {record.checkOutTime && (
                            <div className="flex items-center text-xs text-gray-500">
                              <span className="mr-1">〜</span>
                              {new Date(record.checkOutTime).toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline">未出勤</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
