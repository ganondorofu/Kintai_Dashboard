
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

interface StatItemProps {
  label: string;
  value: React.ReactNode;
  loading?: boolean;
}

const StatItem = ({ label, value, loading }: StatItemProps) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-muted-foreground">{label}</span>
    {loading ? <Skeleton className="h-5 w-24" /> : <span className="font-semibold">{value}</span>}
  </div>
);

interface UserInfoCardProps {
  user: AppUser;
  teamName: string | null;
}

export const UserInfoCard: React.FC<UserInfoCardProps> = ({ user, teamName }) => {
  const isLoading = teamName === null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザー情報</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <StatItem label="名前" value={`${user.lastname} ${user.firstname}`} />
          <StatItem label="所属班" value={teamName || '未所属'} loading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
};
