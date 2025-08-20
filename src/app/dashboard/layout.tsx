'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, BarChart, LogOut, Loader, Settings } from 'lucide-react';
import { signOutUser } from '@/lib/firebase';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, appUser, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.replace('/');
    return null;
  }
  
  if (!appUser) {
    // Still loading app user data, or user is not registered in Firestore yet.
    // Can show a specific message or a loader.
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-4">Finalizing your setup...</p>
      </div>
    )
  }

  const handleLogout = async () => {
    await signOutUser();
    router.push('/');
  };
  
  const getInitials = (firstname: string, lastname: string) => {
    return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user.photoURL ?? undefined} alt={`${appUser.firstname} ${appUser.lastname}`} />
              <AvatarFallback>{getInitials(appUser.firstname, appUser.lastname)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold">{appUser.firstname} {appUser.lastname}</span>
              <span className="text-sm text-muted-foreground">{appUser.github}</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/dashboard" tooltip="Dashboard">
                <LayoutDashboard />
                Dashboard
              </SidebarMenuButton>
            </SidebarMenuItem>
            {appUser.role === 'admin' && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton href="/dashboard/users" tooltip="User Management">
                    <Users />
                    User Management
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton href="/dashboard/analytics" tooltip="Analytics">
                    <BarChart />
                    Analytics
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <Button variant="ghost" className="justify-start w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
