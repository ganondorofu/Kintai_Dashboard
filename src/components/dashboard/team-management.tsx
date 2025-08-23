
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getTeamMembers, getTeamAttendanceLogs, getAllUsers, getAllTeams, updateUser, formatKisei } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog, Team } from '@/types';

interface TeamManagementProps {
  currentUser: AppUser;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [teamLogs, setTeamLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const isAdmin = currentUser.role === 'admin';
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fetchedTeams, fetchedUsers] = await Promise.all([
          getAllTeams(),
          isAdmin ? getAllUsers() : getTeamMembers(currentUser.teamId || '')
        ]);
        
        setTeams(fetchedTeams);
        setUsers(fetchedUsers);
        
        // デフォルトで自分のチームを選択
        if (!isAdmin && currentUser.teamId) {
          setSelectedTeam(currentUser.teamId);
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, isAdmin]);

  useEffect(() => {
    const fetchTeamLogs = async () => {
      if (!selectedTeam) return;
      
      try {
        const logs = await getTeamAttendanceLogs(selectedTeam);
        setTeamLogs(logs);
      } catch (error) {
        console.error('チーム勤怠ログ取得エラー:', error);
      }
    };

    fetchTeamLogs();
  }, [selectedTeam]);

  const handleUserUpdate = async (uid: string, updates: Partial<AppUser>) => {
    try {
      await updateUser(uid, updates);
      setUsers(prev => prev.map(user => 
        user.uid === uid ? { ...user, ...updates } : user
      ));
      setEditingUser(null);
    } catch (error) {
      console.error('ユーザー更新エラー:', error);
    }
  };

  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || `班${teamId}`;
  };

  const filteredUsers = selectedTeam 
    ? users.filter(user => user.teamId === selectedTeam)
    : users;

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ユーザー一覧 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium mb-4">
            {selectedTeam ? `${getTeamName(selectedTeam)} メンバー` : 'ユーザー一覧'}
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    名前
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GitHub
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    学年
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    班
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役割
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.uid}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.lastname} {user.firstname}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.github}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatKisei(user.grade || 10)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.teamId ? getTeamName(user.teamId) : '未配属'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'admin' ? '管理者' : 'ユーザー'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          編集
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* チーム勤怠ログ */}
      {selectedTeam && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium mb-4">
              {getTeamName(selectedTeam)} 勤怠ログ
            </h3>
            
            {teamLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ユーザー
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        日時
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        種別
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {teamLogs.slice(0, 20).map((log) => {
                      const user = users.find(u => u.uid === log.uid);
                      return (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {user ? `${user.lastname} ${user.firstname}` : log.uid}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.timestamp && typeof log.timestamp.toDate === 'function' 
                              ? format(log.timestamp.toDate(), 'MM/dd HH:mm', { locale: ja })
                              : '不明'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              log.type === 'entry' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {log.type === 'entry' ? '入室' : '退室'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">勤怠ログがありません</p>
            )}
          </div>
        </div>
      )}

      {/* ユーザー編集モーダル */}
      {editingUser && isAdmin && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold mb-4">ユーザー編集</h3>
            
            <div className="space-y-4">
               <div>
                <label className="block text-sm font-medium text-gray-700">カードID</label>
                <input
                  type="text"
                  value={editingUser.cardId || ''}
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
                  {teams.map(team => (
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
                  value={editingUser.grade}
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
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
