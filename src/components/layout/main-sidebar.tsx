
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/firebase-auth-provider';
import { useDashboard } from '@/contexts/dashboard-context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Calendar, 
  ChevronDown,
  ChevronRight,
  Users,
  LogOut
} from 'lucide-react';
import { getTodayAttendanceStats, debugAttendanceLogs, createTodayTestAttendanceLogs } from '@/lib/data-adapter';

interface TeamData {
  teamId: string;
  teamName: string;
  grade: string;
  members: any[];
  presentCount: number;
  totalCount: number;
}

interface MainSidebarProps {
  onClose?: () => void;
}

export default function MainSidebar({ onClose }: MainSidebarProps) {
  const { user, signOut } = useAuth();
  const { allUsers } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();
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

  // メインナビゲーション
  const navigation = [
    { name: 'ダッシュボード', href: '/dashboard', icon: Home, current: pathname === '/dashboard' },
    { name: 'NFC勤怠記録', href: '/kiosk', icon: Calendar, current: pathname === '/kiosk' },
  ];

  // 班データの構築
  useEffect(() => {
    const buildTeamData = async () => {
      if (!allUsers || allUsers.length === 0) {
        console.log('MainSidebar: allUsers is empty or undefined');
        setLoading(false);
        return;
      }

      try {
        const today = new Date();
        console.log('MainSidebar: Fetching today stats for:', today);
        
        // デバッグ用：出席ログをチェック
        await debugAttendanceLogs();
        
        const todayStats = await getTodayAttendanceStats();
        console.log('MainSidebar: Today stats received:', todayStats);

        // 管理者か一般ユーザーかでフィルタリング
        const isAdmin = user?.role === 'admin';
        const currentUserGrade = user?.grade;
        
        // 班ごとにユーザーをグループ化
        const teamGroups = allUsers.reduce((acc, member) => {
          const teamId = member.teamId || `${member.grade}年生` || '未所属';
          
          // 一般ユーザーの場合、自分の学年のみ表示
          if (!isAdmin && member.grade !== currentUserGrade) {
            return acc;
          }
          
          if (!acc[teamId]) {
            acc[teamId] = {
              teamId,
              teamName: teamId,
              grade: convertPeriodToGrade(teamId),
              members: [],
              presentCount: 0,
              totalCount: 0
            };
          }

          // 今日の出席状況を確認
          const userGradeStats = todayStats?.statsByGrade?.[member.grade];
          const isPresent = userGradeStats?.users?.some((u: any) => u.uid === member.uid) || false;

          acc[teamId].members.push({
            ...member,
            isPresent
          });
          acc[teamId].totalCount++;
          if (isPresent) {
            acc[teamId].presentCount++;
          }

          return acc;
        }, {} as Record<string, TeamData>);

        const sortedTeams = Object.values(teamGroups).sort((a, b) => 
          a.grade.localeCompare(b.grade, 'ja')
        );

        console.log('MainSidebar: Sorted teams:', sortedTeams);
        setTeams(sortedTeams);
      } catch (error) {
        console.error('班データの構築に失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    buildTeamData();
  }, [allUsers, user]);

  const toggleTeam = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

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
        <Calendar className="h-6 w-6 text-blue-600 mr-2" />
        <h1 className="text-lg font-bold text-gray-900">勤怠管理システム</h1>
      </div>

      {/* ナビゲーション */}
      <div className="flex-1 overflow-y-auto">
        <nav className="px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                item.current
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* 班一覧 */}
        <div className="px-2 py-4">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            班別出席状況
          </h3>
          
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">読み込み中...</div>
          ) : (
            <div className="space-y-1">
              {teams.map((team) => (
                <div key={team.teamId}>
                  <div 
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                    onClick={() => handleTeamClick(team.teamId)}
                  >
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-left truncate font-medium">
                        {team.grade}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={team.presentCount === team.totalCount ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {team.presentCount}/{team.totalCount}
                      </Badge>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTeam(team.teamId);
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {expandedTeams.has(team.teamId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {expandedTeams.has(team.teamId) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {team.members.map((member) => (
                        <div 
                          key={member.uid} 
                          className="flex items-center justify-between px-3 py-1 text-xs hover:bg-gray-50 rounded cursor-pointer transition-colors"
                          onClick={() => handleMemberClick(member.uid)}
                        >
                          <span className="text-gray-600 truncate text-left">
                            {member.lastname} {member.firstname}
                          </span>
                          <Badge 
                            variant={member.isPresent ? "default" : "outline"}
                            className="text-xs"
                          >
                            {member.isPresent ? '出席' : '未出席'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* フッター（ユーザー情報・ログアウト） */}
      {user && (
        <div className="flex-shrink-0 border-t px-4 py-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="text-sm font-medium text-gray-900">
              {user.firstname} {user.lastname}
            </div>
            <div className="text-xs text-gray-500">
              {user.role === 'admin' ? '管理者' : '一般ユーザー'}
            </div>
          </div>
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
