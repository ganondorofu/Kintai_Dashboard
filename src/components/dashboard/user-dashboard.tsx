'use client';

import { useState, useEffect } from 'react';
import { AttendanceLogs } from './attendance-logs';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { getUserAttendanceLogsV2, createAttendanceLogV2, formatKiseiAsGrade } from '@/lib/data-adapter';
import { Button } from '@/components/ui/button';
import type { AppUser, AttendanceLog } from '@/types';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'team' | 'calendar'>('overview');
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ totalDays: 0, attendedDays: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<'entry' | 'exit' | null>(null);

  // 今日の勤怠記録を取得
  const fetchTodayLogs = async () => {
    try {
      const today = new Date();
      const startToday = startOfDay(today);
      const endToday = endOfDay(today);
      
      const logs = await getUserAttendanceLogsV2(user.uid, startToday, endToday, 10);
      setTodayLogs(logs);
      
      if (logs.length > 0) {
        setLastAction(logs[0].type);
      }
    } catch (error) {
      console.error('今日の勤怠記録取得エラー:', error);
    }
  };

  // 今月の統計を取得
  const fetchMonthlyStats = async () => {
    try {
      const today = new Date();
      const startMonth = startOfMonth(today);
      const endMonth = endOfMonth(today);
      
      const logs = await getUserAttendanceLogsV2(user.uid, startMonth, endMonth, 1000);
      
      // 日付ごとに出勤記録をグループ化
      const attendedDates = new Set<string>();
      logs.forEach(log => {
        if (log.type === 'entry') {
          const dateKey = log.timestamp.toDate().toDateString();
          attendedDates.add(dateKey);
        }
      });
      
      const totalDays = today.getDate(); // 今月の現在までの日数
      const attendedDays = attendedDates.size;
      
      setMonthlyStats({ totalDays, attendedDays });
    } catch (error) {
      console.error('月次統計取得エラー:', error);
    }
  };

  useEffect(() => {
    fetchTodayLogs();
    fetchMonthlyStats();
  }, [user.uid]);

  // 出勤/退勤ボタンのハンドラー
  const handleAttendance = async (type: 'entry' | 'exit') => {
    setIsLoading(true);
    try {
      const success = await createAttendanceLogV2(user.uid, type);
      if (success) {
        await fetchTodayLogs(); // 記録を更新
        setLastAction(type);
      }
    } catch (error) {
      console.error('勤怠記録エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'overview' as const, label: '概要' },
    { id: 'attendance' as const, label: '勤怠記録' },
    { id: 'team' as const, label: 'チーム管理' },
    { id: 'calendar' as const, label: '出席カレンダー' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          こんにちは、{user.firstname}さん！
        </h1>
        <p className="text-gray-600">
          ダッシュボードです。
        </p>
        <div className="mt-4 flex space-x-4 text-sm text-gray-500">
          <span>GitHubアカウント: {user.github}</span>
          <span>{formatKiseiAsGrade(user.grade || 10)}</span>
          {user.teamId && <span>班: {user.teamId}</span>}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
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
              {/* 出勤/退勤ボタン */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">勤怠記録</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => handleAttendance('entry')}
                    disabled={isLoading || lastAction === 'entry'}
                    size="lg"
                    className="h-16 bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                  >
                    {isLoading ? '記録中...' : '出勤'}
                  </Button>
                  
                  <Button
                    onClick={() => handleAttendance('exit')}
                    disabled={isLoading || lastAction === 'exit' || lastAction === null}
                    size="lg"
                    variant="destructive"
                    className="h-16"
                  >
                    {isLoading ? '記録中...' : '退勤'}
                  </Button>
                </div>
                <div className="mt-2 text-center text-sm text-gray-600">
                  {lastAction === 'entry' && '現在勤務中です'}
                  {lastAction === 'exit' && '退勤済みです'}
                  {lastAction === null && '今日はまだ勤怠記録がありません'}
                </div>
              </div>

              {/* 統計カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">今日の勤怠</h3>
                  <p className="text-3xl font-bold text-blue-600">{todayLogs.length}</p>
                  <p className="text-sm text-blue-700">記録回数</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">今月の出席</h3>
                  <p className="text-3xl font-bold text-green-600">{monthlyStats.attendedDays}/{monthlyStats.totalDays}</p>
                  <p className="text-sm text-green-700">日</p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">出席率</h3>
                  <p className="text-3xl font-bold text-purple-600">
                    {monthlyStats.totalDays > 0 ? Math.round((monthlyStats.attendedDays / monthlyStats.totalDays) * 100) : 0}%
                  </p>
                  <p className="text-sm text-purple-700">今月</p>
                </div>
              </div>
              
              {/* 最近の活動 */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">今日の活動</h3>
                {todayLogs.length === 0 ? (
                  <p className="text-gray-600">今日はまだ勤怠記録がありません</p>
                ) : (
                  <div className="space-y-3">
                    {todayLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between">
                        <span className="text-gray-600">
                          {log.timestamp.toDate().toLocaleTimeString('ja-JP')} - {log.type === 'entry' ? '出勤' : '退勤'}
                        </span>
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <AttendanceLogs user={user} />
          )}

          {activeTab === 'team' && (
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
