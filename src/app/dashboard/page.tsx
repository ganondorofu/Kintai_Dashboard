
'use client';

import { useAuth } from '@/components/firebase-auth-provider';
import AdminDashboard from '@/components/dashboard/admin-dashboard';
import UserDashboard from '@/components/dashboard/user-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { user: appUser, loading } = useAuth();

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
          <Link href="/login">
            <Button size="lg">ログイン</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  // ユーザーの役割に応じて表示するダッシュボードを切り替え
  if (appUser.role === 'admin') {
    return <AdminDashboard />;
  } else {
    return <UserDashboard user={appUser} />;
  }
}


function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-1/3" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
