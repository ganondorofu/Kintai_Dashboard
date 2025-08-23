
'use client';

import { AttendanceLogs } from './attendance-logs';
import type { AppUser } from '@/types';
import { UserInfoCard } from './user-info-card';
import { useDashboard } from '@/contexts/dashboard-context';
import { Skeleton } from '@/components/ui/skeleton';


interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const { allTeams, isLoading } = useDashboard();

  if (isLoading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Skeleton className="h-64" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          個人ダッシュボード
        </h1>
        <p className="text-gray-600">
          こんにちは、{user.lastname} {user.firstname}さん！あなたの個人ダッシュボードです。
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          <UserInfoCard user={user} allTeams={allTeams} />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2">
          <AttendanceLogs user={user} />
        </div>
      </div>
    </div>
  );
}
