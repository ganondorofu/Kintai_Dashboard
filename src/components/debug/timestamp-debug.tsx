'use client';

import { useState, useEffect } from 'react';
import { getAllUsers, getAllAttendanceLogs, formatKiseiAsGrade, createAttendanceLogLegacyFormat } from '@/lib/data-adapter';
import type { AppUser, AttendanceLog } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TimestampDebug() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedUsers, fetchedLogs] = await Promise.all([
        getAllUsers(),
        getAllAttendanceLogs()
      ]);
      setUsers(fetchedUsers);
      setLogs(fetchedLogs.slice(0, 10)); // 最新10件のみ表示
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createTestLog = async () => {
    if (users.length > 0) {
      const testUser = users[0];
      await createAttendanceLogLegacyFormat(testUser.uid, testUser.cardId || 'test', 'entry');
      await fetchData(); // データを再取得
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>期生・学年変換デバッグ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-x-2">
            <Button onClick={fetchData} disabled={loading}>
              {loading ? '読み込み中...' : 'データ再取得'}
            </Button>
            <Button onClick={createTestLog} variant="secondary">
              テスト出勤記録作成
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ユーザー一覧と期生変換 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">ユーザー一覧（期生→学年変換）</h3>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">名前</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">期生データ</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">学年変換</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.uid}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {user.lastname} {user.firstname}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {user.grade}期生
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {formatKiseiAsGrade(user.grade || 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 出勤ログとTimestamp形式 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">出勤ログ（Timestamp形式）</h3>
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {logs.map((log, index) => (
                    <div key={log.id || index} className="bg-gray-50 p-3 rounded">
                      <div className="text-sm">
                        <div><strong>UID:</strong> {log.uid.substring(0, 10)}...</div>
                        <div><strong>Type:</strong> {log.type}</div>
                        <div><strong>Timestamp Type:</strong> {typeof log.timestamp}</div>
                        <div><strong>Constructor:</strong> {log.timestamp?.constructor?.name}</div>
                        <div><strong>Has toDate:</strong> {log.timestamp && typeof log.timestamp.toDate === 'function' ? 'Yes' : 'No'}</div>
                        <div><strong>Value:</strong> {log.timestamp?.toString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 期生変換テーブル */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3">期生・学年変換テーブル（2025年基準）</h3>
            <div className="bg-blue-50 p-4 rounded">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="font-medium">期生</div>
                <div className="font-medium">学年（2025年）</div>
                <div className="font-medium">変換例</div>
                
                <div>8期生</div>
                <div>3年生</div>
                <div>{formatKiseiAsGrade(8)}</div>
                
                <div>9期生</div>
                <div>2年生</div>
                <div>{formatKiseiAsGrade(9)}</div>
                
                <div>10期生</div>
                <div>1年生</div>
                <div>{formatKiseiAsGrade(10)}</div>
                
                <div>11期生</div>
                <div>推定（将来）</div>
                <div>{formatKiseiAsGrade(11)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
