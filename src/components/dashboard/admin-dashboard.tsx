
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { forceClockOutAllActiveUsers, getForceClockOutSettings, updateForceClockOutSettings } from '@/lib/data-adapter';
import type { AppUser, CronSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/contexts/dashboard-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminDashboard() {
  const { appUser } = useAuth();
  const { refreshData } = useDashboard();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'calendar' | 'settings'>('users');
  const [isForcingCheckout, setIsForcingCheckout] = useState(false);
  const [cronSettings, setCronSettings] = useState<CronSettings>({});
  const [isSavingCron, setIsSavingCron] = useState(false);

  useEffect(() => {
    getForceClockOutSettings().then(settings => {
      if (settings) {
        setCronSettings(settings);
      }
    });
  }, []);

  const handleForceCheckout = async () => {
    setIsForcingCheckout(true);
    try {
      const result = await forceClockOutAllActiveUsers();
      toast({
        title: "強制退勤処理が完了しました",
        description: `退勤処理: ${result.success}件, 対象外: ${result.noAction}件, 失敗: ${result.failed}件`,
      });
      await refreshData();
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

  const handleSaveCronSettings = async () => {
    setIsSavingCron(true);
    try {
      await updateForceClockOutSettings(
        cronSettings.forceClockOutStartTime || "23:55",
        cronSettings.forceClockOutEndTime || "23:59"
      );
      toast({
        title: "設定を保存しました",
        description: "自動強制退勤の時間を更新しました。",
      });
    } catch (error) {
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました。",
        variant: "destructive",
      });
    } finally {
      setIsSavingCron(false);
    }
  };


  if (!appUser) return <Skeleton className="h-96 w-full" />;

  const tabs = [
    { id: 'users' as const, label: 'ユーザー管理' },
    { id: 'calendar' as const, label: '出席カレンダー' },
    { id: 'settings' as const, label: 'システム設定' },
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
                {isForcingCheckout ? '処理中...' : '手動で全員強制退勤'}
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
          {activeTab === 'settings' && (
            <Card>
              <CardHeader>
                <CardTitle>自動強制退勤設定</CardTitle>
                <CardDescription>cron.yamlで設定されたスケジュールでAPIが呼び出された際、ここで設定した時間帯の場合のみ強制退勤が実行されます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">開始時刻</Label>
                    <Input 
                      id="start-time"
                      type="time" 
                      value={cronSettings.forceClockOutStartTime || "23:55"}
                      onChange={e => setCronSettings(prev => ({...prev, forceClockOutStartTime: e.target.value}))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">終了時刻</Label>
                    <Input 
                      id="end-time"
                      type="time" 
                      value={cronSettings.forceClockOutEndTime || "23:59"}
                      onChange={e => setCronSettings(prev => ({...prev, forceClockOutEndTime: e.target.value}))}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveCronSettings} disabled={isSavingCron}>
                  {isSavingCron ? "保存中..." : "設定を保存"}
                </Button>
                 <p className="text-xs text-muted-foreground">
                  例えば、23:00から翌02:00のように夜間をまたいで設定することも可能です。
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
