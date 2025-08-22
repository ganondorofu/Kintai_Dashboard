
'use client';

import { AttendanceSystem } from './attendance-system';
import { AttendanceStats } from './attendance-stats';
import type { AppUser } from '@/types';

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          こんにちは、{user.firstname} {user.lastname}さん！
        </h1>
        <p className="text-gray-600">
          あなたの個人ダッシュボードです。
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AttendanceSystem user={user} />
        <AttendanceStats user={user} />
      </div>
    </div>
  );
}
