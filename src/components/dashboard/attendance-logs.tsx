'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getUserAttendanceLogs } from '@/lib/data-adapter';
import type { AttendanceLog, AppUser } from '@/types';

interface AttendanceLogsProps {
  user: AppUser;
  startDate?: Date;
  endDate?: Date;
}

export const AttendanceLogs: React.FC<AttendanceLogsProps> = ({ 
  user, 
  startDate, 
  endDate 
}) => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const fetchedLogs = await getUserAttendanceLogs(user.uid, startDate, endDate);
        setLogs(fetchedLogs);
      } catch (error) {
        console.error('勤怠ログ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user.uid, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        指定された期間の勤怠記録はありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">勤怠記録</h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                日時
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                種別
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                カードID
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.timestamp && typeof log.timestamp.toDate === 'function' 
                    ? format(log.timestamp.toDate(), 'yyyy年MM月dd日 HH:mm:ss', { locale: ja })
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.cardId || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
