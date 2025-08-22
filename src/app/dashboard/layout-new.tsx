'use client';

import SidebarLayout from '@/components/layout/sidebar-layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
