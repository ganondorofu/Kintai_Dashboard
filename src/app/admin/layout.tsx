
'use client';

import SidebarLayout from '@/components/layout/sidebar-layout';
import { DashboardProvider } from '@/contexts/dashboard-context';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <SidebarLayout>{children}</SidebarLayout>
    </DashboardProvider>
  );
}
