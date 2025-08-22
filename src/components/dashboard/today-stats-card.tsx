'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/contexts/dashboard-context';
import type { AttendanceLog } from '@/types';

interface TodayStatsCardProps {
  className?: string;
}

export const TodayStatsCard: React.FC<TodayStatsCardProps> = ({ className }) => {
  const { todayStats, userProfile } = useDashboard();
  const [greeting, setGreeting] = useState<string>('');

  // 時間帯による挨拶
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) {
      setGreeting('お疲れ様です');
    } else if (hour < 12) {
      setGreeting('おはようございます');
    } else if (hour < 18) {
      setGreeting('こんにちは');
    } else {
      setGreeting('お疲れ様です');
    }
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'entry': return 'bg-blue-100 text-blue-800';
      case 'exit': return 'bg-red-100 text-red-800';
      case 'break_start': return 'bg-yellow-100 text-yellow-800';
      case 'break_end': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'entry': return '出勤';
      case 'exit': return '退勤';
      case 'break_start': return '休憩開始';
      case 'break_end': return '休憩終了';
      default: return status;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>本日の出勤状況</span>
          <div className="text-sm font-normal text-gray-600">
            {greeting}
            {userProfile && `, ${userProfile.lastname}さん`}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 今日の記録 */}
          {todayStats && todayStats.logs.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">
                本日の記録 ({todayStats.logs.length}件)
              </div>
              <div className="space-y-2">
                {todayStats.logs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(log.status)}>
                        {getStatusText(log.status)}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 勤務時間計算 */}
              {todayStats.workingMinutes > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-sm text-gray-600">
                    本日の勤務時間: {Math.floor(todayStats.workingMinutes / 60)}時間{todayStats.workingMinutes % 60}分
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              本日の出勤記録はありません
            </div>
          )}

          {/* クイックアクション */}
          <div className="pt-2 border-t">
            <div className="text-xs text-gray-400">
              出勤・退勤の記録は<strong>キオスク</strong>ページで行えます
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
