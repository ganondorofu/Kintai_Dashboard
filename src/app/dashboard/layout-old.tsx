'use client';

import SidebarLayout from '@/components/layout/sidebar-layout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout>{children}</SidebarLayout>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await firebaseSignOut();
    router.push('/login');
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
              <AvatarImage src={user.photoURL ?? undefined} alt={`${user.firstname} ${user.lastname}`} />
              <AvatarFallback>{getInitials(user.firstname, user.lastname)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold">{user.firstname} {user.lastname}</span>
              <span className="text-sm text-muted-foreground">{user.github}</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="/dashboard" tooltip="ダッシュボード">
                <LayoutDashboard />
                ダッシュボード
              </SidebarMenuButton>
            </SidebarMenuItem>
            {user.role === 'admin' && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton href="/dashboard/users" tooltip="ユーザー管理">
                    <Users />
                    ユーザー管理
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <Button variant="ghost" className="justify-start w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
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
