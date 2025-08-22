'use client';

import { useState } from 'react';
import { AttendanceSystem } from './attendance-system';
import { AttendanceStats } from './attendance-stats';
import { AttendanceLogs } from './attendance-logs';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import type { AppUser } from '@/types';

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboardV2({ user }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<'system' | 'stats' | 'attendance' | 'team' | 'calendar'>('system');

  const tabs = [
    { id: 'system' as const, label: '勤怠記録' },
    { id: 'stats' as const, label: '統計' },
    { id: 'attendance' as const, label: '履歴' },
    { id: 'team' as const, label: 'チーム管理' },
    { id: 'calendar' as const, label: 'カレンダー' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          こんにちは、{user.firstname}さん！
        </h1>
        <p className="text-gray-600">
          IT勤怠管理システムダッシュボードです。
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
          <span>GitHubアカウント: {user.github}</span>
          <span>学年: {user.grade}年</span>
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
          {activeTab === 'system' && <AttendanceSystem user={user} />}
          {activeTab === 'stats' && <AttendanceStats user={user} />}
          {activeTab === 'attendance' && <AttendanceLogs user={user} />}
          {activeTab === 'team' && <TeamManagement currentUser={user} />}
          {activeTab === 'calendar' && <AttendanceCalendar currentUser={user} />}
        </div>
      </div>
    </div>
  );
}
