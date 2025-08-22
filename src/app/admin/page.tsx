'use client';

import { useAuth } from '@/components/firebase-auth-provider';
import AdminDashboard from '@/components/dashboard/admin-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const { user: appUser, loading } = useAuth();

  if (loading) {
    return <AdminSkeleton />;
  }

  if (!appUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">管理者画面</h1>
        <p className="text-lg text-gray-600">ログインが必要です</p>
        <Link href="/login">
          <Button size="lg">ログイン</Button>
        </Link>
      </div>
    );
  }

  if (appUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">アクセス拒否</h1>
        <p className="text-lg text-gray-600">管理者権限が必要です</p>
        <Link href="/dashboard">
          <Button size="lg">ダッシュボードに戻る</Button>
        </Link>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminSkeleton() {
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
