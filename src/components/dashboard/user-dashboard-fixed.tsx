'use client';

import { useState } from 'react';
import { AttendanceLogs } from './attendance-logs';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import type { AppUser } from '@/types';

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'team' | 'calendar'>('overview');

  const tabs = [
    { id: 'overview' as const, label: '概要' },
    { id: 'attendance' as const, label: '勤怠記録' },
    { id: 'team' as const, label: 'チーム管理' },
    { id: 'calendar' as const, label: '出席カレンダー' },
  ];

  return (
    <div className="space-y-6">
      {/* ウェルカムメッセージ */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          こんにちは、{user.firstname}さん！
        </h1>
        <p className="text-gray-600">
          ダッシュボードです。
        </p>
        <div className="mt-4 flex space-x-4 text-sm text-gray-500">
          <span>GitHubアカウント: {user.github}</span>
          <span>学年: {user.grade}年</span>
          {user.teamId && <span>班: {user.teamId}</span>}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">総訪問回数</h3>
                <p className="text-3xl font-bold text-blue-600">-</p>
                <p className="text-sm text-blue-700">データを読み込み中...</p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-2">今月の出席日数</h3>
                <p className="text-3xl font-bold text-green-600">-</p>
                <p className="text-sm text-green-700">データを読み込み中...</p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">平均滞在時間</h3>
                <p className="text-3xl font-bold text-purple-600">-</p>
                <p className="text-sm text-purple-700">データを読み込み中...</p>
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
