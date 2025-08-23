
'use client';

import { useState } from 'react';
import MainSidebar from './main-sidebar';
import { 
  Menu,
  X,
} from 'lucide-react';
import { useDashboard } from '@/contexts/dashboard-context';
import { Badge } from '@/components/ui/badge';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { cacheStatus } = useDashboard();

  const getCacheStatusLabel = () => {
    switch (cacheStatus) {
      case 'loading':
        return { text: '通信中...', variant: 'default' as const, className: 'bg-yellow-500 text-white animate-pulse' };
      case 'cached':
        return { text: 'キャッシュ', variant: 'outline' as const, className: 'border-blue-500 text-blue-600' };
      case 'fresh':
        return { text: '最新', variant: 'default' as const, className: 'bg-green-500 text-white' };
      case 'error':
        return { text: 'エラー', variant: 'destructive' as const, className: 'bg-red-500 text-white' };
      default:
        return null;
    }
  }

  const statusLabel = getCacheStatusLabel();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* サイドバー（モバイル）*/}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <MainSidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* サイドバー（デスクトップ）*/}
      <div className="hidden md:flex md:w-80 md:flex-col md:fixed md:inset-y-0">
        <MainSidebar />
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-col flex-1 md:ml-80">
        {/* トップバー */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-6 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">STEM研究部勤怠管理システム</h1>
            {statusLabel && (
              <Badge variant={statusLabel.variant} className={statusLabel.className}>
                {statusLabel.text}
              </Badge>
            )}
          </div>
        </div>

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
