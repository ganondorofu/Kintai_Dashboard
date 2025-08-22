'use client';

import { useState } from 'react';
import { useAuth } from '@/components/firebase-auth-provider';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { TimestampDebug } from '@/components/debug/timestamp-debug';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'calendar' | 'debug'>('overview');

  if (!user) return null;

  const tabs = [
    { id: 'overview' as const, label: '概要' },
    { id: 'users' as const, label: 'ユーザー管理' },
    { id: 'calendar' as const, label: '出席カレンダー' },
    { id: 'debug' as const, label: 'デバッグ' },
  ];

  return (
    <div className="space-y-6">
      {/* 管理者ウェルカムメッセージ */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          管理者ダッシュボード
        </h1>
        <p className="text-gray-600">
          こんにちは、{user.firstname}さん（管理者）
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">総ユーザー数</h3>
                  <p className="text-3xl font-bold text-blue-600">-</p>
                  <p className="text-sm text-blue-700">システム登録者</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">今日の出席者</h3>
                  <p className="text-3xl font-bold text-green-600">-</p>
                  <p className="text-sm text-green-700">本日入室した人数</p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">アクティブ班数</h3>
                  <p className="text-3xl font-bold text-purple-600">-</p>
                  <p className="text-sm text-purple-700">活動中の班</p>
                </div>

                <div className="bg-orange-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">今月の記録数</h3>
                  <p className="text-3xl font-bold text-orange-600">-</p>
                  <p className="text-sm text-orange-700">出退勤記録</p>
                </div>
              </div>

              {/* 最近のアクティビティ */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">最近のシステムアクティビティ</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>システムが正常に稼働中です</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Firebase接続が正常です</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>統計データを準備中...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <TeamManagement currentUser={user} />
          )}

          {activeTab === 'calendar' && (
            <AttendanceCalendar currentUser={user} />
          )}

          {activeTab === 'debug' && (
            <TimestampDebug />
          )}
        </div>
      </div>
    </div>
  );
}
