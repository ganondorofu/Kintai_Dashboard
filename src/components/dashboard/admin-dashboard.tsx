

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { TeamManagement } from './team-management';
import { AttendanceCalendar } from './attendance-calendar';
import { forceClockOutAllActiveUsers, getForceClockOutSettings, updateForceClockOutSettings, getApiCallLogs, safeTimestampToDate, getNotifications, createNotification, updateNotification, deleteNotification } from '@/lib/data-adapter';
import type { AppUser, CronSettings, ApiCallLog, Notification } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/contexts/dashboard-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

function ApiCallHistory() {
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const fetchedLogs = await getApiCallLogs('/api/force-clock-out', 20);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Failed to fetch API call logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5 * 60 * 1000); // 5分ごとに更新
    return () => clearInterval(interval);
  }, []);

  return (
     <Card>
        <CardHeader>
          <CardTitle>強制退勤API 実行履歴</CardTitle>
          <CardDescription>
            cronジョブまたは手動によるAPI呼び出しの最新20件の履歴です。
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto">
          {loading ? (
             <p>読み込み中...</p>
          ) : logs.length === 0 ? (
             <p className="text-muted-foreground">履歴はありません。</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const timestamp = safeTimestampToDate(log.timestamp);
                return (
                  <div key={log.id} className="text-sm p-3 border rounded-md">
                    <p className="font-semibold">
                      {timestamp ? timestamp.toLocaleString('ja-JP') : '日付不明'}
                    </p>
                    <p className="text-muted-foreground">
                      ステータス: <span className={`font-medium ${
                        log.status === 'success' ? 'text-green-600' :
                        log.status === 'error' ? 'text-red-600' :
                        log.status === 'skipped' ? 'text-yellow-600' : ''
                      }`}>{log.status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {JSON.stringify(log.result)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
     </Card>
  );
}

function NotificationManager({ user }: { user: AppUser }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Partial<Notification> | null>(null);
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(50);
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast({ title: 'エラー', description: 'お知らせの取得に失敗しました。', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleOpenDialog = (notification?: Notification) => {
    setEditingNotification(notification || { title: '', content: '', level: 'info' });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingNotification || !editingNotification.title || !editingNotification.content) {
      toast({ title: '入力エラー', description: 'タイトルと内容は必須です。', variant: 'destructive' });
      return;
    }

    try {
      if (editingNotification.id) {
        // Update
        await updateNotification(editingNotification.id, {
          title: editingNotification.title,
          content: editingNotification.content,
          level: editingNotification.level,
        });
        toast({ title: '成功', description: 'お知らせを更新しました。' });
      } else {
        // Create
        await createNotification({
          title: editingNotification.title,
          content: editingNotification.content,
          level: editingNotification.level || 'info',
          authorId: user.uid,
          authorName: `${user.lastname} ${user.firstname}`,
        });
        toast({ title: '成功', description: 'お知らせを作成しました。' });
      }
      setIsDialogOpen(false);
      setEditingNotification(null);
      fetchNotifications();
    } catch (error) {
      console.error("Failed to save notification:", error);
      toast({ title: 'エラー', description: 'お知らせの保存に失敗しました。', variant: 'destructive' });
    }
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm("このお知らせを本当に削除しますか？")) {
      try {
        await deleteNotification(id);
        toast({ title: '成功', description: 'お知らせを削除しました。' });
        fetchNotifications();
      } catch (error) {
        console.error("Failed to delete notification:", error);
        toast({ title: 'エラー', description: 'お知らせの削除に失敗しました。', variant: 'destructive' });
      }
    }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>お知らせ管理</CardTitle>
            <CardDescription>ユーザーのダッシュボードに表示されるお知らせを管理します。</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>読み込み中...</p>
        ) : notifications.length === 0 ? (
          <p className="text-muted-foreground">お知らせはありません。</p>
        ) : (
          <div className="space-y-4">
            {notifications.map(n => (
              <div key={n.id} className="border p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <Badge variant={n.level === 'important' ? 'destructive' : n.level === 'warning' ? 'default' : 'secondary'} className={n.level === 'warning' ? 'bg-yellow-500' : ''}>{n.level}</Badge>
                      <h4 className="font-semibold">{n.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      作成者: {n.authorName} / {safeTimestampToDate(n.createdAt)?.toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(n)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(n.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNotification?.id ? 'お知らせを編集' : '新しいお知らせを作成'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input
                id="title"
                value={editingNotification?.title || ''}
                onChange={(e) => setEditingNotification(p => p ? { ...p, title: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={editingNotification?.content || ''}
                onChange={(e) => setEditingNotification(p => p ? { ...p, content: e.target.value } : null)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">重要度</Label>
              <Select
                value={editingNotification?.level || 'info'}
                onValueChange={(value) => setEditingNotification(p => p ? { ...p, level: value as any } : null)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">情報</SelectItem>
                  <SelectItem value="warning">警告</SelectItem>
                  <SelectItem value="important">重要</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


export default function AdminDashboard() {
  const { appUser } = useAuth();
  const { refreshData } = useDashboard();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'calendar' | 'settings' | 'notifications'>('users');
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
    { id: 'notifications' as const, label: 'お知らせ管理' },
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
          {activeTab === 'notifications' && (
            <NotificationManager user={appUser} />
          )}
          {activeTab === 'calendar' && (
            <AttendanceCalendar currentUser={appUser} />
          )}
          {activeTab === 'settings' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <ApiCallHistory />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
