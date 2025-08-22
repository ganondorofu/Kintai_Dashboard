'use client';

import { useState } from 'react';
import { useAuth } from '@/components/firebase-auth-provider';
import { TeamSidebar } from '@/components/dashboard/team-sidebar';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  HomeIcon, 
  UserGroupIcon, 
  CalendarIcon, 
  CogIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const navigation = [
    { name: 'ダッシュボード', href: '/dashboard', icon: HomeIcon, current: pathname === '/dashboard' },
    { name: 'NFC勤怠記録', href: '/kiosk', icon: CalendarIcon, current: pathname === '/kiosk' },
    ...(isAdmin ? [
      { name: '管理画面', href: '/admin', icon: CogIcon, current: pathname === '/admin' },
    ] : []),
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー（モバイル）*/}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent 
            navigation={navigation} 
            user={user} 
            onSignOut={handleSignOut}
            onClose={() => setSidebarOpen(false)}
            pathname={pathname}
          />
        </div>
      </div>

      {/* サイドバー（デスクトップ）*/}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent 
          navigation={navigation} 
          user={user} 
          onSignOut={handleSignOut}
          pathname={pathname}
        />
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-col flex-1 md:ml-64">
        {/* トップバー */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">IT勤怠管理システム</h1>
            <div className="flex items-center space-x-4">
              {user && (
                <span className="text-sm text-gray-700">
                  {user.firstname}さん
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  navigation: any[];
  user: any;
  onSignOut: () => void;
  onClose?: () => void;
  pathname: string;
}

function SidebarContent({ navigation, user, onSignOut, onClose, pathname }: SidebarContentProps) {
  return (
    <div className="flex flex-col flex-grow bg-white pt-5 pb-4 overflow-y-auto">
      <div className="flex items-center flex-shrink-0 px-4">
        <h1 className="text-xl font-bold text-gray-900">IT勤怠</h1>
      </div>
      <div className="mt-5 flex-grow flex flex-col">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                item.current
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          ))}
        </nav>
        
        {/* 班一覧（ダッシュボードページでのみ表示） */}
        {pathname === '/dashboard' && (
          <div className="px-2 py-4">
            <TeamSidebar />
          </div>
        )}
        
        {/* ユーザー情報とログアウト */}
        {user && (
          <div className="flex-shrink-0 px-2 pb-4">
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="text-sm font-medium text-gray-900">
                {user.firstname} {user.lastname}
              </div>
              <div className="text-xs text-gray-500">
                {user.role === 'admin' ? '管理者' : '一般ユーザー'}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              className="w-full flex items-center"
            >
              <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
              ログアウト
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
