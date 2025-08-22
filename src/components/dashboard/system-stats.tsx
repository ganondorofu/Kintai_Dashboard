'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { AppUser } from '@/types';

interface SystemStatsProps {
  allUsers: AppUser[];
  isAdmin?: boolean;
}

export const SystemStats: React.FC<SystemStatsProps> = ({ allUsers, isAdmin = false }) => {
  // 学年変換
  const convertPeriodToGrade = (teamId: string) => {
    if (teamId?.includes('10期生')) return '1年生';
    if (teamId?.includes('9期生')) return '2年生';
    if (teamId?.includes('8期生')) return '3年生';
    return teamId || '未所属';
  };

  // 学年別統計
  const getGradeStats = () => {
    const stats = {
      '1年生': { total: 0, active: 0 },
      '2年生': { total: 0, active: 0 },
      '3年生': { total: 0, active: 0 },
      'その他': { total: 0, active: 0 }
    };

    allUsers.forEach(user => {
      const grade = convertPeriodToGrade(user.teamId);
      const category = ['1年生', '2年生', '3年生'].includes(grade) ? grade as keyof typeof stats : 'その他';
      
      stats[category].total++;
      if (user.isActive !== false) {
        stats[category].active++;
      }
    });

    return stats;
  };

  const gradeStats = getGradeStats();

  return (
    <Card>
      <CardHeader>
        <CardTitle>システム統計</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span>総ユーザー数:</span>
            <span className="font-semibold">{allUsers.length}名</span>
          </div>
          <div className="flex justify-between">
            <span>アクティブユーザー:</span>
            <span className="font-semibold">{allUsers.filter(u => u.isActive !== false).length}名</span>
          </div>
          
          {/* 学年別統計 */}
          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">学年別統計</div>
            <div className="space-y-2">
              {Object.entries(gradeStats).map(([grade, stats]) => 
                stats.total > 0 ? (
                  <div key={grade} className="flex justify-between items-center">
                    <span className="text-sm">{grade}:</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {stats.active}/{stats.total}名
                      </Badge>
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* 管理機能（管理者のみ） */}
          {isAdmin && (
            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-2">管理機能</div>
              <div className="space-y-3">
                <Link href="/kiosk">
                  <Button className="w-full" variant="outline" size="sm">
                    キオスク管理
                  </Button>
                </Link>
                <Button className="w-full" variant="outline" size="sm" disabled>
                  ユーザー管理（準備中）
                </Button>
                <Button className="w-full" variant="outline" size="sm" disabled>
                  レポート出力（準備中）
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
