
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AppUser, AttendanceLog } from '@/types';
import { getUserAttendanceLogsV2, getAllTeams } from '@/lib/data-adapter';

interface UserInfoCardProps {
  user: AppUser;
}

export const UserInfoCard: React.FC<UserInfoCardProps> = ({ user }) => {
  const [lastLog, setLastLog] = useState<AttendanceLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch last log
        const logs = await getUserAttendanceLogsV2(user.uid, undefined, undefined, 1);
        setLastLog(logs.length > 0 ? logs[0] : null);

        // Fetch team name
        if (user.teamId) {
          const teams = await getAllTeams();
          const team = teams.find(t => t.id === user.teamId);
          setTeamName(team?.name || user.teamId);
        } else {
          setTeamName('未所属');
        }
      } catch (error) {
        console.error("Failed to fetch user info data", error);
        setTeamName(user.teamId || '未所属');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.uid, user.teamId]);

  const currentStatus = loading ? '確認中...' : (lastLog?.type === 'entry' ? '出勤中' : '退勤済み');
  const statusColor = currentStatus === '出勤中' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';

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
            <span className="font-semibold">{teamName ?? '読み込み中...'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">勤務状況</span>
            <Badge variant="outline" className={statusColor}>
              {currentStatus}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
