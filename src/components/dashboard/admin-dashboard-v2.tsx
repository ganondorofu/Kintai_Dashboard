'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDailyAttendanceStatsV2, calculateMonthlyAttendanceStatsWithCacheV2 } from '@/lib/data-adapter';
import { Users, Calendar, TrendingUp, Download, RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AdminStats {
  totalStudents: number;
  presentToday: number;
  totalTeams: number;
  attendanceRate: number;
}

export function AdminDashboard() {
  const [todayStats, setTodayStats] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalStudents: 0,
    presentToday: 0,
    totalTeams: 0,
    attendanceRate: 0
  });
  const [monthlyData, setMonthlyData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 今日の統計を取得
  const loadTodayStats = async () => {
    try {
      const stats = await getDailyAttendanceStatsV2(selectedDate);
      setTodayStats(stats);
      
      // 管理者向け集計を計算
      let totalStudents = 0;
      let presentToday = 0;
      const totalTeams = stats.length;
      
      stats.forEach(team => {
        team.gradeStats.forEach((grade: any) => {
          totalStudents += grade.users.length;
          presentToday += grade.count;
        });
      });
      
      const attendanceRate = totalStudents > 0 ? (presentToday / totalStudents) * 100 : 0;
      
      setAdminStats({
        totalStudents,
        presentToday,
        totalTeams,
        attendanceRate
      });
    } catch (error) {
      console.error('今日の統計取得に失敗:', error);
    }
  };

  // 月次統計を取得
  const loadMonthlyStats = async () => {
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const data = await calculateMonthlyAttendanceStatsWithCacheV2(year, month);
      setMonthlyData(data);
    } catch (error) {
      console.error('月次統計取得に失敗:', error);
    }
  };

  // データを更新
  const refreshData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadTodayStats(), loadMonthlyStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadTodayStats(), loadMonthlyStats()]);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [selectedDate]);

  // CSVエクスポート
  const exportToCSV = () => {
    if (todayStats.length === 0) return;
    
    const csvData = [
      ['日付', 'チーム', '学年', '出席者数', '総人数', '出席率'],
      ...todayStats.flatMap(team => 
        team.gradeStats.map((grade: any) => [
          format(selectedDate, 'yyyy-MM-dd'),
          team.teamName || team.teamId,
          `${grade.grade}年`,
          grade.count,
          grade.users.length,
          grade.users.length > 0 ? `${((grade.count / grade.users.length) * 100).toFixed(1)}%` : '0%'
        ])
      )
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">管理者ダッシュボード</h1>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="px-3 py-2 border rounded-md"
          />
          <Button onClick={refreshData} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            更新
          </Button>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            CSV出力
          </Button>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">総学生数</p>
                <p className="text-2xl font-bold text-gray-900">{adminStats.totalStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {format(selectedDate, 'M/d', { locale: ja })}出席者
                </p>
                <p className="text-2xl font-bold text-gray-900">{adminStats.presentToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">出席率</p>
                <p className="text-2xl font-bold text-gray-900">
                  {adminStats.attendanceRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">チーム数</p>
                <p className="text-2xl font-bold text-gray-900">{adminStats.totalTeams}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* チーム別詳細 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {format(selectedDate, 'M月d日', { locale: ja })}のチーム別出席状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              出席データがありません
            </div>
          ) : (
            <div className="space-y-6">
              {todayStats.map((team) => (
                <div key={team.teamId} className="border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    {team.teamName || `チーム${team.teamId}`}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {team.gradeStats.map((grade: any) => {
                      const gradeAttendanceRate = grade.users.length > 0 
                        ? (grade.count / grade.users.length) * 100 
                        : 0;
                      
                      return (
                        <div key={grade.grade} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{grade.grade}年生</h4>
                            <span className={`px-2 py-1 text-xs rounded ${
                              gradeAttendanceRate >= 80 
                                ? 'bg-green-100 text-green-800'
                                : gradeAttendanceRate >= 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {gradeAttendanceRate.toFixed(1)}%
                            </span>
                          </div>
                          
                          <div className="text-2xl font-bold text-gray-900 mb-1">
                            {grade.count} / {grade.users.length}
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-3">
                            出席者 / 総人数
                          </div>
                          
                          {grade.users.length > 0 && (
                            <details className="text-sm">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                メンバー詳細
                              </summary>
                              <div className="mt-2 space-y-1">
                                {grade.users.map((user: any) => (
                                  <div key={user.uid} className="flex justify-between">
                                    <span>{user.firstname} {user.lastname}</span>
                                    <span className={user.isPresent ? 'text-green-600' : 'text-gray-400'}>
                                      {user.isPresent ? '出席' : '欠席'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 月次統計サマリー */}
      {Object.keys(monthlyData).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {format(selectedDate, 'yyyy年M月', { locale: ja })}の月次統計
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(monthlyData).map(([dateKey, stats]: [string, any]) => (
                <div key={dateKey} className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-medium mb-2">
                    {format(new Date(dateKey), 'M/d', { locale: ja })}
                  </div>
                  <div className="text-lg font-bold">
                    {stats.totalCount}名出席
                  </div>
                  <div className="text-sm text-gray-600">
                    {stats.teamStats.length}チーム
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
