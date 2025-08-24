
'use client';

import SidebarLayout from '@/components/layout/sidebar-layout';
import { DashboardProvider } from '@/contexts/dashboard-context';

export default function DashboardLayout({
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
