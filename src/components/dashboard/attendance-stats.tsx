'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserAttendanceLogsV2, getDailyAttendanceStatsV2 } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { Calendar, Clock, TrendingUp, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
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
  const [monthlyStats, setMonthlyStats] = useState<DayStats[]>([]);
  const [teamStats, setTeamStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // 月次統計を計算
  const calculateMonthlyStats = async (targetMonth: Date) => {
    try {
      setLoading(true);
      const startDate = startOfMonth(targetMonth);
      const endDate = endOfMonth(targetMonth);
      
      // 指定月のすべての勤怠記録を取得
      const logs = await getUserAttendanceLogsV2(user.uid, startDate, endDate, 1000);
      
      // 日付ごとにグループ化
      const dayMap = new Map<string, AttendanceLog[]>();
      logs.forEach(log => {
        const dateKey = format(log.timestamp.toDate(), 'yyyy-MM-dd');
        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, []);
        }
        dayMap.get(dateKey)!.push(log);
      });

      // 月のすべての日に対して統計を計算
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const stats: DayStats[] = days.map(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayLogs = dayMap.get(dateKey) || [];
        
        // 出勤・退勤記録を分類
        const entryLogs = dayLogs.filter(log => log.type === 'entry');
        const exitLogs = dayLogs.filter(log => log.type === 'exit');
        
        const hasEntry = entryLogs.length > 0;
        const hasExit = exitLogs.length > 0;
        
        // 最初の出勤と最後の退勤を使用
        const entryTime = hasEntry ? entryLogs[entryLogs.length - 1].timestamp.toDate() : undefined;
        const exitTime = hasExit ? exitLogs[0].timestamp.toDate() : undefined;
        
        // 勤務時間計算
        let workingHours: number | undefined;
        if (entryTime && exitTime) {
          workingHours = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
        }
        
        return {
          date: day,
          hasEntry,
          hasExit,
          entryTime,
          exitTime,
          workingHours
        };
      });

      setMonthlyStats(stats);
    } catch (error) {
      console.error('月次統計の計算に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // チーム統計を取得
  const loadTeamStats = async () => {
    try {
      const today = new Date();
      const stats = await getDailyAttendanceStatsV2(today);
      setTeamStats(stats);
    } catch (error) {
      console.error('チーム統計の取得に失敗:', error);
    }
  };

  useEffect(() => {
    calculateMonthlyStats(selectedMonth);
    loadTeamStats();
  }, [selectedMonth, user.uid]);

  // 月の集計値
  const monthSummary = {
    totalDays: monthlyStats.length,
    attendedDays: monthlyStats.filter(day => day.hasEntry).length,
    completeDays: monthlyStats.filter(day => day.hasEntry && day.hasExit).length,
    totalHours: monthlyStats
      .filter(day => day.workingHours)
      .reduce((sum, day) => sum + (day.workingHours || 0), 0),
    averageHours: 0
  };
  
  const completeDaysCount = monthlyStats.filter(day => day.workingHours).length;
  if (completeDaysCount > 0) {
    monthSummary.averageHours = monthSummary.totalHours / completeDaysCount;
  }

  // 今月の出席率
  const attendanceRate = monthSummary.totalDays > 0 
    ? (monthSummary.attendedDays / monthSummary.totalDays) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* 月選択 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            統計期間
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="month"
            value={format(selectedMonth, 'yyyy-MM')}
            onChange={(e) => setSelectedMonth(parseISO(e.target.value + '-01'))}
            className="px-3 py-2 border rounded-md"
          />
        </CardContent>
      </Card>

      {/* 月次サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">出席日数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {monthSummary.attendedDays}/{monthSummary.totalDays}
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
                <p className="text-sm font-medium text-gray-600">出席率</p>
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
                <p className="text-sm font-medium text-gray-600">総勤務時間</p>
                <p className="text-2xl font-bold text-gray-900">
                  {monthSummary.totalHours.toFixed(1)}h
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
                <p className="text-sm font-medium text-gray-600">平均勤務時間</p>
                <p className="text-2xl font-bold text-gray-900">
                  {monthSummary.averageHours.toFixed(1)}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 詳細統計 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {format(selectedMonth, 'yyyy年M月', { locale: ja })}の詳細
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">読み込み中...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {monthlyStats.map((day) => (
                <div key={day.date.toISOString()} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium min-w-[100px]">
                      {format(day.date, 'M/d (E)', { locale: ja })}
                    </div>
                    <div className="flex gap-2">
                      {day.hasEntry && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          出勤
                        </span>
                      )}
                      {day.hasExit && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                          退勤
                        </span>
                      )}
                      {!day.hasEntry && !day.hasExit && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          記録なし
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {day.entryTime && (
                      <div>出勤: {format(day.entryTime, 'HH:mm')}</div>
                    )}
                    {day.exitTime && (
                      <div>退勤: {format(day.exitTime, 'HH:mm')}</div>
                    )}
                    {day.workingHours && (
                      <div className="font-medium">
                        勤務: {day.workingHours.toFixed(1)}h
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* チーム統計 */}
      {teamStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              今日のチーム状況
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamStats.map((team) => (
                <div key={team.teamId} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">
                    {team.teamName || team.teamId}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {team.gradeStats.map((grade: any) => (
                      <div key={grade.grade} className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {grade.count}
                        </div>
                        <div className="text-sm text-gray-600">
                          {grade.grade}年生
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
