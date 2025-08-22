

'use client';

import { useState, useEffect } from 'react';
import { getUserAttendanceLogsV2 } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LogIn, LogOut, Clock, User, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AttendanceSystemProps {
  user: AppUser;
}

export function AttendanceSystem({ user }: AttendanceSystemProps) {
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [lastAction, setLastAction] = useState<'entry' | 'exit' | null>(null);

  // 最近の勤怠記録を取得
  const fetchRecentLogs = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const logs = await getUserAttendanceLogsV2(user.uid, startOfDay, today, 10);
      setRecentLogs(logs);
      
      if (logs.length > 0) {
        setLastAction(logs[0].type);
      } else {
        setLastAction(null);
      }
    } catch (error) {
      console.error('勤怠記録の取得に失敗:', error);
    }
  };

  useEffect(() => {
    fetchRecentLogs();
    const interval = setInterval(fetchRecentLogs, 60000); // 1分ごとに更新
    return () => clearInterval(interval);
  }, [user.uid]);

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            勤怠ステータス
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          
          <div className="text-center text-sm text-gray-600 p-4 bg-gray-50 rounded-lg">
            {lastAction === 'entry' && '現在出勤中です。お疲れ様です！'}
            {lastAction === 'exit' && '退勤済みです。本日もお疲れ様でした。'}
            {lastAction === null && '今日はまだ出勤記録がありません。'}
             <p className="text-xs text-gray-400 mt-2">勤怠の記録はNFCカードで行ってください。</p>
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
