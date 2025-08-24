
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
  Users,
  LogOut,
  Shield,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { getDailyAttendanceStatsV2, getTeamMembers } from '@/lib/data-adapter';

interface TeamMember {
  uid: string;
  firstname: string;
  lastname: string;
  github: string;
  isPresent: boolean;
  status: '出勤中' | '退勤';
}

interface TeamData {
  teamId: string;
  teamName: string;
  members: TeamMember[];
  presentCount: number;
  totalCount: number;
}

interface MainSidebarProps {
  onClose?: () => void;
}

export default function MainSidebar({ onClose }: MainSidebarProps) {
  const { appUser, signOut } = useAuth();
  const { allTeams } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = appUser?.role === 'admin';

  // 班データの構築
  useEffect(() => {
    const buildTeamData = async () => {
      setLoading(true);
      try {
        const todayStats = await getDailyAttendanceStatsV2(new Date());
        
        const teamNameMap = allTeams.reduce((acc, team) => {
          acc[team.id] = team.name;
          return acc;
        }, {} as Record<string, string>);

        const teamDataPromises = allTeams.map(async (team) => {
          const teamStat = todayStats.find(t => t.teamId === team.id);
          
          let presentMembers: TeamMember[] = [];
          let presentCount = 0;
          let totalCount = 0;

          const teamMembers = await getTeamMembers(team.id);
          totalCount = teamMembers.length;

          if (teamStat) {
            teamStat.gradeStats.forEach(grade => {
                grade.users.forEach(user => {
                    if (user.isPresent) {
                        presentMembers.push({
                            ...user,
                            status: '出勤中'
                        });
                    }
                });
            });
             presentCount = presentMembers.length;
          }

          return {
            teamId: team.id,
            teamName: team.name,
            members: presentMembers,
            presentCount,
            totalCount
          };
        });

        const resolvedTeams = await Promise.all(teamDataPromises);
        const sortedTeams = resolvedTeams
          .filter(team => team.totalCount > 0) // メンバーがいない班は表示しない
          .sort((a, b) => a.teamName.localeCompare(b.teamName, 'ja'));

        setTeams(sortedTeams);
      } catch (error) {
        console.error('サイドバーのチームデータ構築エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    if (allTeams.length > 0) {
      buildTeamData();
    }
  }, [allTeams]);

  const handleTeamClick = (teamId: string) => {
    if (isAdmin) {
      router.push(`/dashboard/team/${encodeURIComponent(teamId)}`);
      onClose?.();
    }
  };

  const handleMemberClick = (memberUid: string) => {
    if (isAdmin) {
      router.push(`/dashboard/member/${memberUid}`);
      onClose?.();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
      onClose?.();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="flex items-center flex-shrink-0 px-4 py-4 border-b border-sidebar-border">
        {/* Header content here */}
      </div>

      <div className="flex-1 overflow-y-auto">
        <nav className="px-2 py-4 space-y-1">
          <Link
            href="/dashboard"
            onClick={onClose}
            className={cn(
              'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              pathname === '/dashboard'
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50'
            )}
          >
            <Home className="mr-3 h-5 w-5 flex-shrink-0" />
            個人ダッシュボード
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                pathname.startsWith('/admin')
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50'
              )}
            >
              <Shield className="mr-3 h-5 w-5 flex-shrink-0" />
              管理者ダッシュボード
            </Link>
          )}
        </nav>

        <div className="px-2 py-4">
          <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider mb-2">
            班別出勤状況
          </h3>
          
          {loading ? (
            <div className="px-3 py-2 text-sm text-sidebar-foreground/70">読み込み中...</div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-1">
              {teams.map((team) => (
                <AccordionItem value={team.teamId} key={team.teamId} className="border-b-0">
                   <AccordionTrigger 
                     className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-sidebar-accent/50 rounded-lg transition-colors cursor-pointer no-underline hover:no-underline"
                   >
                    <div 
                        className="flex items-center flex-grow"
                        onClick={(e) => { if(isAdmin) { e.stopPropagation(); handleTeamClick(team.teamId); }}}
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
                      {team.members.length > 0 ? team.members.map((member) => (
                        <div 
                          key={member.uid} 
                          className={cn(
                            "flex items-center justify-between px-3 py-1 text-xs hover:bg-sidebar-accent/50 rounded transition-colors",
                             isAdmin ? "cursor-pointer" : "cursor-default"
                          )}
                          onClick={() => handleMemberClick(member.uid)}
                        >
                          <span className="truncate text-left">
                            {member.lastname} {member.firstname}
                          </span>
                          <Badge 
                            variant="default"
                            className="text-xs bg-green-500/20 text-green-700 border-green-500/30"
                          >
                            出勤中
                          </Badge>
                        </div>
                      )) : (
                        <div className="px-3 py-1 text-xs text-sidebar-foreground/70">
                          現在、出勤中のメンバーはいません。
                        </div>
                      )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>

      {appUser && (
        <div className="flex-shrink-0 border-t border-sidebar-border px-4 py-4">
          <Button
            variant="ghost"
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
