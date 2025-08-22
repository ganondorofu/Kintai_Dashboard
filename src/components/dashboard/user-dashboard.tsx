
'use client';

import { AttendanceLogs } from './attendance-logs';
import { AttendanceStats } from './attendance-stats';
import type { AppUser } from '@/types';
import { UserInfoCard } from './user-info-card';
import { useDashboard } from '@/contexts/dashboard-context';


interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const { allTeams, isLoading } = useDashboard();

  if (isLoading) {
      return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          個人ダッシュボード
        </h1>
        <p className="text-gray-600">
          こんにちは、{user.firstname} {user.lastname}さん！あなたの個人ダッシュボードです。
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          <UserInfoCard user={user} allTeams={allTeams} />
          <AttendanceStats user={user} />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2">
          <AttendanceLogs user={user} />
        </div>
      </div>
    </div>
  );
}
