

'use client';

import { useState } from 'react';
import { useAuth } from '@/components/firebase-auth-provider';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { forceClockOutAllUsers } from '@/lib/data-adapter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'calendar'>('users');
  const [isForcingCheckout, setIsForcingCheckout] = useState(false);

  const handleForceCheckout = async () => {
    setIsForcingCheckout(true);
    try {
      const result = await forceClockOutAllUsers();
      toast({
        title: "強制退勤処理が完了しました",
        description: `成功: ${result.success}件, 対象外: ${result.noAction}件, 失敗: ${result.failed}件`,
      });
      // You might want to refresh data here if needed
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

  if (!user) return <Skeleton className="h-96 w-full" />;

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
                    ? 'border-purple-500 text-purple-600'
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
            <TeamManagement currentUser={user} />
          )}
          {activeTab === 'calendar' && (
            <AttendanceCalendar currentUser={user} />
          )}
        </div>
      </div>
    </div>
  );
}
