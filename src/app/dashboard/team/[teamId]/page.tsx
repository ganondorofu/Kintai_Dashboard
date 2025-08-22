
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Calendar, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAllUsers, getDailyAttendanceStatsV2, getAllTeams, getUserAttendanceRecords } from '@/lib/data-adapter';
import type { User, Team } from '@/types';

interface TeamStats {
  teamId: string;
  teamName: string;
  members: User[];
  totalMembers: number;
  presentToday: number;
  averageAttendance: number;
  monthlyAttendance: { [key: string]: number };
}

export default function TeamStatsPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;
  
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamDefinitions, setTeamDefinitions] = useState<Team[]>([]);
  const [todayStatsData, setTodayStatsData] = useState<any>(null);

  useEffect(() => {
    const fetchTeamStats = async () => {
      try {
        const [users, teams] = await Promise.all([
          getAllUsers(),
          getAllTeams()
        ]);
        setTeamDefinitions(teams);
        
        const teamMembers = users.filter(user => user.teamId === teamId);
        
        const currentTeam = teams.find(t => t.id === teamId);

        if (teamMembers.length === 0 || !currentTeam) {
          setTeamStats(null);
          setLoading(false);
          return;
        }

        // 今日の出勤状況を取得
        const todayStats = await getDailyAttendanceStatsV2(new Date());
        setTodayStatsData(todayStats);

        const currentTeamStats = todayStats.find(t => t.teamId === teamId);
        const presentToday = currentTeamStats?.gradeStats.reduce((acc, g) => acc + g.count, 0) || 0;

        // 月間出席率を計算
        let totalAttendedDays = 0;
        for (const member of teamMembers) {
          const records = await getUserAttendanceRecords(member.uid, 30);
          totalAttendedDays += records.filter(r => r.checkInTime).length;
        }
        
        const averageAttendance = teamMembers.length > 0 ? 
          Math.round((totalAttendedDays / (teamMembers.length * 30)) * 100) : 0;
          
        setTeamStats({
          teamId,
          teamName: currentTeam.name,
          members: teamMembers,
          totalMembers: teamMembers.length,
          presentToday,
          averageAttendance,
          monthlyAttendance: {} // 月間データは別途実装が必要
        });
      } catch (error) {
        console.error('Failed to fetch team stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (teamId) {
        fetchTeamStats();
    }
  }, [teamId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <div className="text-lg text-gray-500">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!teamStats) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>
        <div className="text-center py-8">
          <div className="text-lg text-gray-500">班が見つかりませんでした</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="h-6 w-6 mr-2" />
            {teamStats.teamName} 班統計
          </h1>
          <p className="text-gray-600 mt-1">
            班全体の出勤状況と統計情報
          </p>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">班員数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.totalMembers}人</div>
            <p className="text-xs text-muted-foreground">登録済み班員</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日の出勤</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.presentToday}人</div>
            <p className="text-xs text-muted-foreground">
              出勤率: {teamStats.totalMembers > 0 ? Math.round((teamStats.presentToday / teamStats.totalMembers) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">月間平均出勤率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.averageAttendance}%</div>
            <p className="text-xs text-muted-foreground">過去30日間</p>
          </CardContent>
        </Card>
      </div>

      {/* 班員リスト */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            班員一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamStats.members.map((member) => {
              // 今日の統計から実際の出勤状況を確認
              let isPresent = false;
              const teamStat = todayStatsData?.find((t: any) => t.teamId === member.teamId);
              if (teamStat) {
                const gradeStat = teamStat.gradeStats.find((g: any) => g.grade === member.grade);
                if (gradeStat) {
                  const userInStats = gradeStat.users.find((u: any) => u.uid === member.uid);
                  if (userInStats) {
                    isPresent = userInStats.isPresent;
                  }
                }
              }
              const checkInTime = isPresent ? new Date() : null; // 実際のチェックイン時間は別途取得が必要

              return (
                <div key={member.uid} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {member.firstname?.[0]}{member.lastname?.[0]}
                      </span>
                    </div>
                    <div>
                      <button
                        className="font-medium text-gray-900 hover:text-blue-600 hover:underline transition-colors"
                        onClick={() => router.push(`/dashboard/member/${member.uid}`)}
                      >
                        {member.firstname} {member.lastname}
                      </button>
                      <p className="text-sm text-gray-500">{member.github}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={isPresent ? "default" : "outline"}>
                      {isPresent ? '出勤中' : '退勤'}
                    </Badge>
                    {checkInTime && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {checkInTime.toLocaleTimeString('ja-JP', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
