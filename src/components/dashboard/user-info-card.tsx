
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { convertPeriodToGrade } from '@/lib/attendance-utils';
import type { AppUser } from '@/types';

interface UserInfoCardProps {
  user: AppUser;
}

export const UserInfoCard: React.FC<UserInfoCardProps> = ({ user }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>あなたの情報</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div><strong>名前:</strong> {user.firstname} {user.lastname}</div>
          <div><strong>GitHubアカウント:</strong> {user.github}</div>
          <div><strong>班:</strong> {convertPeriodToGrade(user.teamId)}</div>
          <div><strong>ロール:</strong> 
            <Badge variant="outline" className="ml-2">
              {user.role === 'admin' ? '管理者' : 'ユーザー'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface AttendanceActionCardProps {
  className?: string;
}

export const AttendanceActionCard: React.FC<AttendanceActionCardProps> = ({ className }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>出勤記録</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            勤怠の記録は専用キオスクで行えます
          </p>
          <Link href="/kiosk">
            <Button className="w-full">
              キオスクページへ
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
