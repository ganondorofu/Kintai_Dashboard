'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useDashboard } from '@/contexts/dashboard-context';
import { getDailyAttendanceStatsV2 } from '@/lib/data-adapter';
import type { AppUser } from '@/types';

interface TeamMember {
  uid: string;
  firstname: string;
  lastname: string;
  github: string;
  isPresent: boolean;
  lastAttendance?: {
    type: 'entry' | 'exit';
    timestamp: string;
  };
}

interface TeamData {
  teamId: string;
  teamName: string;
  grade: string;
  members: TeamMember[];
  presentCount: number;
  totalCount: number;
}

export const TeamSidebar: React.FC = () => {
  const { allUsers } = useDashboard();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // 学年変換関数
  const convertPeriodToGrade = (teamId: string) => {
    if (teamId?.includes('10期生')) return '1年生';
    if (teamId?.includes('9期生')) return '2年生';
    if (teamId?.includes('8期生')) return '3年生';
    return teamId || '未所属';
  };

  // 班データの構築
  useEffect(() => {
    const buildTeamData = async () => {
      if (!allUsers || allUsers.length === 0) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // 今日の出勤データを取得
        const todayStats = await getDailyAttendanceStatsV2(new Date());
        
        // チームごとにユーザーを分類
        const teamMap = new Map<string, TeamData>();
        
        allUsers.forEach(user => {
          const teamId = user.teamId || '未所属';
          const grade = convertPeriodToGrade(teamId);
          
          if (!teamMap.has(teamId)) {
            teamMap.set(teamId, {
              teamId,
              teamName: teamId,
              grade,
              members: [],
              presentCount: 0,
              totalCount: 0
            });
          }
          
          const team = teamMap.get(teamId)!;
          
          // 今日の出勤状況を確認
          let isPresent = false;
          let lastAttendance: TeamMember['lastAttendance'] = undefined;
          
          const teamStats = todayStats.find(stat => stat.teamId === teamId);
          if (teamStats) {
            // チーム統計から個人の状況を確認
            const userInStats = teamStats.gradeStats?.some(gradeStat => 
              gradeStat.users.some(u => u.uid === user.uid)
            );
            isPresent = userInStats || false;
          }
          
          const member: TeamMember = {
            uid: user.uid,
            firstname: user.firstname,
            lastname: user.lastname,
            github: user.github,
            isPresent,
            lastAttendance
          };
          
          team.members.push(member);
          team.totalCount++;
          if (isPresent) {
            team.presentCount++;
          }
        });
        
        // チーム配列として設定（学年順にソート）
        const teamsArray = Array.from(teamMap.values()).sort((a, b) => {
          const gradeOrder = { '1年生': 1, '2年生': 2, '3年生': 3 };
          const aOrder = gradeOrder[a.grade as keyof typeof gradeOrder] || 99;
          const bOrder = gradeOrder[b.grade as keyof typeof gradeOrder] || 99;
          return aOrder - bOrder;
        });
        
        setTeams(teamsArray);
      } catch (error) {
        console.error('チームデータ構築エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    buildTeamData();
  }, [allUsers?.length]); // allUsers.lengthのみに依存

  const toggleTeamExpansion = (teamId: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>班一覧</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {teams.map(team => (
          <div key={team.teamId} className="border rounded-lg p-3">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-2 h-auto"
              onClick={() => toggleTeamExpansion(team.teamId)}
            >
              <div className="flex items-center space-x-2">
                {expandedTeams.has(team.teamId) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium">{team.grade}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {team.presentCount}/{team.totalCount}
                </Badge>
              </div>
            </Button>
            
            {expandedTeams.has(team.teamId) && (
              <div className="mt-3 space-y-2">
                {team.members.map(member => (
                  <div
                    key={member.uid}
                    className={`p-2 rounded border ${
                      member.isPresent 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">
                          {member.lastname} {member.firstname}
                        </div>
                        <div className="text-xs text-gray-500">
                          @{member.github}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={member.isPresent ? "default" : "secondary"}
                          className={
                            member.isPresent 
                              ? "bg-green-100 text-green-800" 
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {member.isPresent ? '出勤中' : '不在'}
                        </Badge>
                        {member.lastAttendance && (
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(member.lastAttendance.timestamp).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
