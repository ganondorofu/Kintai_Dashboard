'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createAttendanceLogV2 } from '@/lib/data-adapter';
import { getUserAttendanceLogsV2 } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LogIn, LogOut, Clock, User, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AttendanceSystemProps {
  user: AppUser;
}

export function AttendanceSystem({ user }: AttendanceSystemProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastAction, setLastAction] = useState<'entry' | 'exit' | null>(null);

  // 最近の勤怠記録を取得
  const fetchRecentLogs = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const logs = await getUserAttendanceLogsV2(user.uid, startOfDay, endOfDay, 10);
      setRecentLogs(logs);
      
      // 最後のアクションを判定
      if (logs.length > 0) {
        setLastAction(logs[0].type);
      }
    } catch (error) {
      console.error('勤怠記録の取得に失敗:', error);
    }
  };

  useEffect(() => {
    fetchRecentLogs();
  }, [user.uid]);

  // 出勤記録
  const handleClockIn = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const success = await createAttendanceLogV2(user.uid, 'entry');
      if (success) {
        setMessage({ type: 'success', text: '出勤を記録しました' });
        setLastAction('entry');
        await fetchRecentLogs();
      } else {
        setMessage({ type: 'error', text: '出勤記録に失敗しました' });
      }
    } catch (error) {
      console.error('出勤記録エラー:', error);
      setMessage({ type: 'error', text: '出勤記録中にエラーが発生しました' });
    } finally {
      setIsLoading(false);
    }
  };

  // 退勤記録
  const handleClockOut = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const success = await createAttendanceLogV2(user.uid, 'exit');
      if (success) {
        setMessage({ type: 'success', text: '退勤を記録しました' });
        setLastAction('exit');
        await fetchRecentLogs();
      } else {
        setMessage({ type: 'error', text: '退勤記録に失敗しました' });
      }
    } catch (error) {
      console.error('退勤記録エラー:', error);
      setMessage({ type: 'error', text: '退勤記録中にエラーが発生しました' });
    } finally {
      setIsLoading(false);
    }
  };

  // 現在の時刻
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 最後の出勤時刻からの経過時間
  const getWorkingTime = () => {
    const lastEntry = recentLogs.find(log => log.type === 'entry');
    if (lastEntry && lastAction === 'entry') {
      return formatDistanceToNow(lastEntry.timestamp.toDate(), { locale: ja, addSuffix: false });
    }
    return null;
  };

  const workingTime = getWorkingTime();

  return (
    <div className="space-y-6">
      {/* 現在時刻表示 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            現在時刻
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-mono font-bold text-center py-4">
            {currentTime.toLocaleTimeString('ja-JP')}
          </div>
          <div className="text-center text-gray-600">
            {currentTime.toLocaleDateString('ja-JP', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric', 
              weekday: 'long' 
            })}
          </div>
        </CardContent>
      </Card>

      {/* 出勤/退勤ボタン */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            勤怠記録
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert className={message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
              <AlertDescription className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {/* 勤務時間表示 */}
          {workingTime && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <LogIn className="h-5 w-5" />
                <span className="font-medium">勤務中</span>
              </div>
              <div className="text-2xl font-bold text-blue-900 mt-2">
                {workingTime}
              </div>
            </div>
          )}

          {/* ボタン */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={handleClockIn}
              disabled={isLoading || lastAction === 'entry'}
              size="lg"
              className="h-16 bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
            >
              <LogIn className="h-6 w-6 mr-2" />
              {isLoading ? '記録中...' : '出勤'}
            </Button>
            
            <Button
              onClick={handleClockOut}
              disabled={isLoading || lastAction === 'exit' || lastAction === null}
              size="lg"
              variant="destructive"
              className="h-16"
            >
              <LogOut className="h-6 w-6 mr-2" />
              {isLoading ? '記録中...' : '退勤'}
            </Button>
          </div>

          {/* 状態表示 */}
          <div className="text-center text-sm text-gray-600">
            {lastAction === 'entry' && '現在勤務中です'}
            {lastAction === 'exit' && '退勤済みです'}
            {lastAction === null && '今日はまだ勤怠記録がありません'}
          </div>
        </CardContent>
      </Card>

      {/* 今日の勤怠記録 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            今日の勤怠記録
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              今日はまだ勤怠記録がありません
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {log.type === 'entry' ? (
                      <LogIn className="h-5 w-5 text-green-600" />
                    ) : (
                      <LogOut className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      {log.type === 'entry' ? '出勤' : '退勤'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">
                      {log.timestamp.toDate().toLocaleTimeString('ja-JP')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDistanceToNow(log.timestamp.toDate(), { locale: ja, addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
