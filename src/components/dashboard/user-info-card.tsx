
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppUser, Team } from '@/types';

interface UserInfoCardProps {
  user: AppUser;
  allTeams: Team[];
}

export const UserInfoCard: React.FC<UserInfoCardProps> = ({ user, allTeams }) => {
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (user.teamId && allTeams.length > 0) {
      const team = allTeams.find(t => t.id === user.teamId);
      setTeamName(team?.name || user.teamId);
    } else {
      setTeamName('未所属');
    }
    setLoading(false);
  }, [user.teamId, allTeams]);

  const teamNameToDisplay = loading ? '読み込み中...' : (teamName || '未所属');

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザー情報</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">名前</span>
            <span className="font-semibold">{user.lastname} {user.firstname}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">所属班</span>
            <span className="font-semibold">{teamNameToDisplay}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
