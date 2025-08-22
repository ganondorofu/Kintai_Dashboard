'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/contexts/dashboard-context';
import { convertGradeToDisplay } from '@/lib/attendance-utils';
import { getTodayAttendanceStats } from '@/lib/data-adapter';

interface TodayStatsCardProps {
  className?: string;
}

export const TodayStatsCard: React.FC<TodayStatsCardProps> = ({ className }) => {
  const { allUsers } = useDashboard();
  const [greeting, setGreeting] = useState<string>('');
  const [todayStats, setTodayStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  // 実際の出席データを取得
  useEffect(() => {
    const fetchTodayStats = async () => {
      try {
        setLoading(true);
        const stats = await getTodayAttendanceStats();
        setTodayStats(stats);
        console.log('TodayStatsCard: Real stats loaded:', stats);
      } catch (error) {
        console.error('TodayStatsCard: Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayStats();
  }, []);

  // 統計データを整理
  const formatTodayStats = () => {
    if (loading || !todayStats) {
      return { totalPresent: 0, totalUsers: allUsers?.length || 0, teamStats: [] };
    }

    const teams = Object.entries(todayStats.statsByGrade).map(([grade, stats]: [string, any]) => {
      const gradeNumber = parseInt(grade);
      const gradeDisplay = convertGradeToDisplay(gradeNumber);
      
      return {
        teamName: gradeDisplay,
        grade: gradeDisplay,
        present: stats.present,
        total: stats.total
      };
    });

    return {
      totalPresent: todayStats.presentUsers,
      totalUsers: todayStats.totalUsers,
      teamStats: teams
    };
  };

  const { totalPresent, totalUsers, teamStats } = formatTodayStats();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>本日の出席状況</span>
          <div className="text-sm font-normal text-gray-600">
            {greeting}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 全体統計 */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {totalPresent}/{totalUsers}
            </div>
            <div className="text-sm text-gray-500">出席者数</div>
          </div>

          {/* 班別統計 */}
          {teamStats.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">班別出席状況</div>
              <div className="space-y-2">
                {teamStats.map((team, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                    <span className="text-sm font-medium">{team.grade}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        {team.present}/{team.total}
                      </span>
                      <Badge 
                        variant={team.present === team.total ? "default" : team.present > team.total * 0.8 ? "secondary" : "destructive"}
                        className="text-xs"
                      >
                        {team.total > 0 ? Math.round((team.present / team.total) * 100) : 0}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              本日の出席データはありません
            </div>
          )}

          {/* フッター */}
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
