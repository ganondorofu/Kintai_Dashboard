
'use client';

import { useAuth } from '@/hooks/use-auth';
import UserDashboard from '@/components/dashboard/user-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { appUser, loading } = useAuth();

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!appUser) {
    // ユーザーがログインしていない場合の表示
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">IT勤怠管理システム</h1>
        <p className="text-lg text-gray-600">ログインが必要です</p>
        <div className="flex gap-4">
          <Link href="/">
            <Button size="lg">ログイン</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <UserDashboard user={appUser} />
    </div>
  );
}


function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
