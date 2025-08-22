
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/firebase-auth-provider';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { getDailyAttendanceStatsV2, formatKiseiAsGrade, forceClockOutAllUsers } from '@/lib/data-adapter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'calendar'>('overview');
  const [todayStats, setTodayStats] = useState<any[]>([]);
  const [adminSummary, setAdminSummary] = useState({
    totalStudents: 0,
    presentToday: 0,
    totalTeams: 0,
    attendanceRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [isForcingCheckout, setIsForcingCheckout] = useState(false);

  // 今日の統計を取得
  const loadTodayStats = async () => {
    try {
      setLoading(true);
      const stats = await getDailyAttendanceStatsV2(new Date());
      setTodayStats(stats);
      
      // 集計を計算
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
      
      setAdminSummary({
        totalStudents,
        presentToday,
        totalTeams,
        attendanceRate
      });
    } catch (error) {
      console.error('統計取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayStats();
  }, []);

  const refreshData = () => {
    loadTodayStats();
  };

  const handleForceCheckout = async () => {
    setIsForcingCheckout(true);
    try {
      const result = await forceClockOutAllUsers();
      toast({
        title: "強制退勤処理が完了しました",
        description: `成功: ${result.success}件, 対象外: ${result.noAction}件, 失敗: ${result.failed}件`,
      });
      refreshData();
    } catch (error) {
      console.error('強制退勤エラー:', error);
      toast({
        title: "エラー",
        description: "強制退勤処理中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsForcingCheckout(false);
    }
  };

  if (!user) return null;

  const tabs = [
    { id: 'overview' as const, label: '概要' },
    { id: 'users' as const, label: 'ユーザー管理' },
    { id: 'calendar' as const, label: '出席カレンダー' },
  ];

  return (
    <div className="space-y-6">
      {/* 管理者ウェルカムメッセージ */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          管理者ダッシュボード
        </h1>
        <p className="text-gray-600">
          こんにちは、{user.firstname} {user.lastname}さん（管理者）
        </p>
        <div className="mt-4 flex space-x-4 text-sm text-gray-500">
          <span>GitHubアカウント: {user.github}</span>
          <span className="text-purple-600 font-semibold">管理者権限</span>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">今日の統計</h2>
                <div className="flex items-center gap-2">
                  <Button onClick={refreshData} variant="outline" disabled={loading}>
                    {loading ? '読み込み中...' : '更新'}
                  </Button>
                  <Button onClick={handleForceCheckout} variant="destructive" disabled={isForcingCheckout}>
                    {isForcingCheckout ? '処理中...' : '強制全員退勤'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">総学生数</h3>
                  <p className="text-3xl font-bold text-blue-600">{adminSummary.totalStudents}</p>
                  <p className="text-sm text-blue-700">システム登録者</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">今日の出席者</h3>
                  <p className="text-3xl font-bold text-green-600">{adminSummary.presentToday}</p>
                  <p className="text-sm text-green-700">本日出勤した人数</p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">出席率</h3>
                  <p className="text-3xl font-bold text-purple-600">{adminSummary.attendanceRate.toFixed(1)}%</p>
                  <p className="text-sm text-purple-700">本日の出席率</p>
                </div>

                <div className="bg-orange-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">アクティブ班数</h3>
                  <p className="text-3xl font-bold text-orange-600">{adminSummary.totalTeams}</p>
                  <p className="text-sm text-orange-700">活動中の班</p>
                </div>
              </div>

              {/* チーム詳細 */}
              {todayStats.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">チーム別詳細</h3>
                  <div className="space-y-4">
                    {todayStats.map((team) => (
                      <div key={team.teamId} className="bg-white rounded-lg p-4">
                        <h4 className="font-medium mb-2">{team.teamName || `チーム${team.teamId}`}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {team.gradeStats.map((grade: any) => (
                            <div key={grade.grade} className="text-center">
                              <div className="text-xl font-bold text-blue-600">
                                {grade.count} / {grade.users.length}
                              </div>
                              <div className="text-sm text-gray-600">
                                {formatKiseiAsGrade(grade.grade)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <TeamManagement currentUser={user} />
          )}

          {activeTab === 'calendar' && (
            <AttendanceCalendar currentUser={user} />
          )}
        </div>
      </div>
    </div>
  );
}
