
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { forceClockOutAllActiveUsers } from '@/lib/data-adapter';
import type { AppUser } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


export default function AdminDashboard() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'calendar'>('users');
  const [isForcingCheckout, setIsForcingCheckout] = useState(false);

  const handleForceCheckout = async () => {
    setIsForcingCheckout(true);
    try {
      const result = await forceClockOutAllActiveUsers();
      toast({
        title: "強制退勤処理が完了しました",
        description: `退勤処理: ${result.success}件, 対象外: ${result.noAction}件, 失敗: ${result.failed}件`,
      });
    } catch (error) {
      console.error('強制退勤エラー:', error);
      toast({
        title: "エラー",
        description: "強制退勤処理中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsForcingCheckout(false);
    }
  };

  useEffect(() => {
    const scheduleAutoCheckout = () => {
      const now = new Date();
      const nextCheckout = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);

      if (now > nextCheckout) {
        nextCheckout.setDate(nextCheckout.getDate() + 1);
      }

      const delay = nextCheckout.getTime() - now.getTime();
      
      const timeoutId = setTimeout(() => {
        handleForceCheckout();
        // Schedule next checkout after 24 hours
        setInterval(handleForceCheckout, 24 * 60 * 60 * 1000);
      }, delay);
      
      return timeoutId;
    };

    const timeoutId = scheduleAutoCheckout();
    
    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!appUser) return <Skeleton className="h-96 w-full" />;

  const tabs = [
    { id: 'users' as const, label: 'ユーザー管理' },
    { id: 'calendar' as const, label: '出席カレンダー' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                 <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    管理者ダッシュボード
                </h1>
                <p className="text-gray-600">
                    システム全体の管理と統計情報を確認します。
                </p>
            </div>
            <Button onClick={handleForceCheckout} variant="destructive" disabled={isForcingCheckout}>
                {isForcingCheckout ? '処理中...' : '強制全員退勤'}
            </Button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <TeamManagement currentUser={appUser} />
          )}
          {activeTab === 'calendar' && (
            <AttendanceCalendar currentUser={appUser} />
          )}
        </div>
      </div>
    </div>
  );
}
