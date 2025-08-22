
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDashboard } from '@/contexts/dashboard-context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  Users,
  LogOut,
  Shield,
} from 'lucide-react';
import { getAllTeams, formatKisei } from '@/lib/data-adapter';
import type { AppUser, Team } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface TeamMember {
  uid: string;
  firstname: string;
  lastname: string;
  github: string;
  isPresent: boolean;
  status: '出勤中' | '退勤';
  lastAttendance?: {
    type: 'entry' | 'exit';
    timestamp: string;
  };
}

interface TeamData {
  teamId: string;
  teamName: string;
  members: any[];
  presentCount: number;
  totalCount: number;
}

interface MainSidebarProps {
  onClose?: () => void;
}

export default function MainSidebar({ onClose }: MainSidebarProps) {
  const { appUser, signOut } = useAuth();
  const { allUsers } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamDefinitions, setTeamDefinitions] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = appUser?.role === 'admin';

  // 班データの構築
  useEffect(() => {
    const buildTeamData = async () => {
      if (!allUsers || allUsers.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const fetchedTeams = await getAllTeams();
        setTeamDefinitions(fetchedTeams);
        const teamNameMap = fetchedTeams.reduce((acc, team) => {
            acc[team.id] = team.name;
            return acc;
        }, {} as Record<string, string>);

        const currentUserTeamId = appUser?.teamId;
        
        // 班ごとにユーザーをグループ化
        const teamGroups = allUsers.reduce((acc, member) => {
          const teamId = member.teamId || 'unassigned';
          
          if (!isAdmin && teamId !== currentUserTeamId) {
            return acc;
          }
          
          if (!acc[teamId]) {
            acc[teamId] = {
              teamId,
              teamName: teamNameMap[teamId] || `班: ${teamId}`,
              members: [],
              presentCount: 0,
              totalCount: 0
            };
          }
          
          const isPresent = member.status === 'active';
          
          acc[teamId].members.push({
            ...member,
            isPresent,
            status: isPresent ? '出勤中' : '退勤'
          });
          acc[teamId].totalCount++;
          if (isPresent) {
            acc[teamId].presentCount++;
          }

          return acc;
        }, {} as Record<string, TeamData>);

        const sortedTeams = Object.values(teamGroups).sort((a, b) => 
          a.teamName.localeCompare(b.teamName)
        );

        setTeams(sortedTeams);
      } catch (error) {
        console.error('班データの構築に失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    buildTeamData();
  }, [allUsers, appUser, isAdmin]);

  const handleTeamClick = (teamId: string) => {
    router.push(`/dashboard/team/${encodeURIComponent(teamId)}`);
    onClose?.();
  };

  const handleMemberClick = (memberUid: string) => {
    router.push(`/dashboard/member/${memberUid}`);
    onClose?.();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
      onClose?.();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ヘッダー */}
      <div className="flex items-center flex-shrink-0 px-4 py-4 border-b">
        <UserIcon className="h-6 w-6 text-blue-600 mr-2" />
        <h1 className="text-lg font-bold text-gray-900">勤怠管理システム</h1>
      </div>

      {/* ナビゲーション */}
      <div className="flex-1 overflow-y-auto">
        <nav className="px-2 py-4 space-y-1">
          <Link
            href="/dashboard"
            onClick={onClose}
            className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              pathname === '/dashboard'
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Home className="mr-3 h-5 w-5 flex-shrink-0" />
            個人ダッシュボード
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-purple-50 text-purple-600 border border-purple-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Shield className="mr-3 h-5 w-5 flex-shrink-0" />
              管理者ダッシュボード
            </Link>
          )}
        </nav>

        {/* 班一覧 */}
        <div className="px-2 py-4">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            班別出勤状況
          </h3>
          
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">読み込み中...</div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-1">
              {teams.map((team) => (
                <AccordionItem value={team.teamId} key={team.teamId} className="border-b-0">
                   <AccordionTrigger 
                     className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer no-underline hover:no-underline"
                   >
                    <div 
                        className="flex items-center flex-grow"
                        onClick={(e) => { e.stopPropagation(); handleTeamClick(team.teamId); }}
                    >
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-left truncate font-medium">
                        {team.teamName}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={team.presentCount === team.totalCount ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {team.presentCount}/{team.totalCount}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="ml-6 mt-1 space-y-1 pr-4">
                      {team.members.map((member) => (
                        <div 
                          key={member.uid} 
                          className="flex items-center justify-between px-3 py-1 text-xs hover:bg-gray-50 rounded cursor-pointer transition-colors"
                          onClick={() => handleMemberClick(member.uid)}
                        >
                          <span className="text-gray-600 truncate text-left">
                            {member.firstname} {member.lastname}
                          </span>
                          <Badge 
                            variant={member.isPresent ? "default" : "outline"}
                            className={cn("text-xs", member.isPresent ? "bg-green-100 text-green-800" : "")}
                          >
                            {member.status}
                          </Badge>
                        </div>
                      ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>

      {/* フッター（ユーザー情報・ログアウト） */}
      {appUser && (
        <div className="flex-shrink-0 border-t px-4 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center"
          >
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </Button>
        </div>
      )}
    </div>
  );
}
