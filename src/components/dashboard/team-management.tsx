'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { updateUser, formatKisei, createAttendanceLogV2 } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog, Team } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useDashboard } from '@/contexts/dashboard-context';

interface TeamManagementProps {
  currentUser: AppUser;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ currentUser }) => {
  const { allUsers, allTeams, refreshData, isLoading: isDashboardLoading } = useDashboard();
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const isAdmin = currentUser.role === 'admin';

  useEffect(() => {
    if (!isAdmin && currentUser.teamId) {
      setSelectedTeam(currentUser.teamId);
    }
  }, [currentUser, isAdmin]);


  const handleUserUpdate = async (uid: string, updates: Partial<AppUser>) => {
    try {
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.cardId) {
        sanitizedUpdates.cardId = sanitizedUpdates.cardId.replace(/:/g, '').toLowerCase();
      }

      await updateUser(uid, sanitizedUpdates);
      await refreshData();
      setEditingUser(null);
      toast({ title: '成功', description: 'ユーザー情報が更新されました。' });
    } catch (error) {
      console.error('ユーザー更新エラー:', error);
      toast({ title: 'エラー', description: 'ユーザー情報の更新に失敗しました。', variant: 'destructive' });
    }
  };

  const handleManualAttendance = async (user: AppUser, type: 'entry' | 'exit') => {
    setIsProcessing(user.uid);
    try {
      await createAttendanceLogV2(user.uid, type, 'manual_admin');
      toast({
        title: '成功',
        description: `${user.lastname} ${user.firstname}さんを${type === 'entry' ? '出勤' : '退勤'}させました。`,
      });
      await refreshData();
    } catch (error) {
      console.error('手動勤怠記録エラー:', error);
      toast({ title: 'エラー', description: '手動での勤怠記録に失敗しました。', variant: 'destructive' });
    } finally {
      setIsProcessing(null);
    }
  };

  const getTeamName = (teamId: string) => {
    const team = allTeams.find(t => t.id === teamId);
    return team?.name || `班${teamId}`;
  };

  const filteredUsers = selectedTeam 
    ? allUsers.filter(user => user.teamId === selectedTeam)
    : allUsers;

  if (isDashboardLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {isAdmin ? 'ユーザー管理' : 'チーム管理'}
        </h2>
        
        {isAdmin && (
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="border rounded-md px-3 py-2"
          >
            <option value="">全ての班</option>
            {allTeams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium mb-4">
            {selectedTeam ? `${getTeamName(selectedTeam)} メンバー` : 'ユーザー一覧'}
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名前</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学年</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">班</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                  {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">手動操作</th>}
                  {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">編集</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.uid}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.lastname} {user.firstname}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatKisei(user.grade || 10)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.teamId ? getTeamName(user.teamId) : '未配属'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.status === 'entry' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status === 'entry' ? '出勤中' : '退勤済み'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {user.status !== 'entry' ? (
                          <Button size="sm" variant="outline" onClick={() => handleManualAttendance(user, 'entry')} disabled={isProcessing === user.uid}>
                            {isProcessing === user.uid ? '処理中...' : '出勤させる'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="destructive" onClick={() => handleManualAttendance(user, 'exit')} disabled={isProcessing === user.uid}>
                             {isProcessing === user.uid ? '処理中...' : '退勤させる'}
                          </Button>
                        )}
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Button variant="link" onClick={() => setEditingUser(user)}>編集</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingUser && isAdmin && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold mb-4">ユーザー編集</h3>
            
            <div className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-700">カードID</label>
                <input
                  type="text"
                  defaultValue={editingUser.cardId || ''}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, cardId: e.target.value } : null)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="NFCカードID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">役割</label>
                <select
                  value={editingUser.role || 'user'}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, role: e.target.value as 'user' | 'admin' } : null)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="user">ユーザー</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">班</label>
                <select
                  value={editingUser.teamId || ''}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, teamId: e.target.value } : null)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">未配属</option>
                  {allTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  期生（数値）
                  <span className="text-xs text-gray-500 ml-2">
                    例: 10期生なら「10」
                  </span>
                </label>
                <input
                  type="number"
                  defaultValue={editingUser.grade}
                  onChange={(e) => setEditingUser(prev => prev ? { ...prev, grade: parseInt(e.target.value) } : null)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="例: 10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  現在設定値: {formatKisei(editingUser.grade || 10)}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleUserUpdate(editingUser.uid, {
                  role: editingUser.role,
                  teamId: editingUser.teamId,
                  grade: editingUser.grade,
                  cardId: editingUser.cardId,
                })}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
