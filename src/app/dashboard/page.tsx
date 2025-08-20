'use client';

import { useAuth } from '@/hooks/use-auth';
import AdminDashboard from '@/components/dashboard/admin-dashboard';
import UserDashboard from '@/components/dashboard/user-dashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { appUser, loading } = useAuth();

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!appUser) {
    // This case should be handled by the layout, but as a fallback:
    return <p>User data not found. Please complete your registration.</p>;
  }

  return appUser.role === 'admin' ? <AdminDashboard /> : <UserDashboard user={appUser} />;
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
