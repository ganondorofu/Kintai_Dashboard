
'use client';

import { useState, useEffect } from 'react';
import { getUserAttendanceLogsV2, safeTimestampToDate } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LogIn, LogOut, Clock, User, Calendar, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AttendanceSystemProps {
  user: AppUser;
}

interface ProcessedLog {
  date: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  workDuration: string | null;
}

export function AttendanceSystem({ user }: AttendanceSystemProps) {
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>([]);
  const [processedLogs, setProcessedLogs] = useState<ProcessedLog[]>([]);
  const [lastAction, setLastAction] = useState<'entry' | 'exit' | null>(null);

  // 最近の勤怠記録を取得
  const fetchRecentLogs = async () => {
    try {
      const today = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(today.getMonth() - 1);
      
      const logs = await getUserAttendanceLogsV2(user.uid, lastMonth, today, 100);
      setRecentLogs(logs);
      
      if (logs.length > 0) {
        // timestampでソートして最新のものを取得
        const sortedLogs = [...logs].sort((a, b) => {
            const timeA = safeTimestampToDate(a.timestamp)?.getTime() || 0;
            const timeB = safeTimestampToDate(b.timestamp)?.getTime() || 0;
            return timeB - timeA;
        });
        setLastAction(sortedLogs[0].type);
        
        // Process logs for monthly history
        const logsByDate: { [key: string]: AttendanceLog[] } = {};
        logs.forEach(log => {
          const logDate = safeTimestampToDate(log.timestamp);
          if (logDate) {
            const dateKey = format(logDate, 'yyyy-MM-dd');
            if (!logsByDate[dateKey]) {
              logsByDate[dateKey] = [];
            }
            logsByDate[dateKey].push(log);
          }
        });

        const processed: ProcessedLog[] = Object.keys(logsByDate).map(dateKey => {
          const dayLogs = logsByDate[dateKey];
          const entries = dayLogs.filter(l => l.type === 'entry').map(l => safeTimestampToDate(l.timestamp)).filter(Boolean) as Date[];
          const exits = dayLogs.filter(l => l.type === 'exit').map(l => safeTimestampToDate(l.timestamp)).filter(Boolean) as Date[];
          
          const checkInTime = entries.length > 0 ? new Date(Math.min(...entries.map(d => d.getTime()))) : null;
          const checkOutTime = exits.length > 0 ? new Date(Math.max(...exits.map(d => d.getTime()))) : null;
          
          let workDuration = null;
          if (checkInTime && checkOutTime && checkOutTime > checkInTime) {
            const minutes = differenceInMinutes(checkOutTime, checkInTime);
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            workDuration = `${hours}時間${remainingMinutes}分`;
          }

          return {
            date: dateKey,
            checkInTime,
            checkOutTime,
            workDuration,
          };
        }).sort((a, b) => b.date.localeCompare(a.date));

        setProcessedLogs(processed.slice(0, 4)); //最新4件
      } else {
        setLastAction(null);
      }
    } catch (error) {
      console.error('勤怠記録の取得に失敗:', error);
      setLastAction(null);
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
    if (lastAction !== 'entry' || recentLogs.length === 0) return null;
    
    const sortedLogs = [...recentLogs].sort((a, b) => {
        const timeA = safeTimestampToDate(a.timestamp)?.getTime() || 0;
        const timeB = safeTimestampToDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
    });
    const lastEntry = sortedLogs.find(log => log.type === 'entry');
    
    if (lastEntry) {
      const entryDate = safeTimestampToDate(lastEntry.timestamp);
      if(entryDate) return formatDistanceToNow(entryDate, { locale: ja, addSuffix: false });
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
    </div>
  );
}
