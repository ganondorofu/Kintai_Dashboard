
'use client';

import { useState, useEffect } from 'react';
import { formatInTimeZone, zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { startOfMonth, endOfMonth, differenceInMinutes, subMonths, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getUserAttendanceLogsV2, safeTimestampToDate } from '@/lib/data-adapter';
import type { AttendanceLog, AppUser } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceLogsProps {
  user: AppUser;
}

interface ProcessedLog {
  date: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  workDuration: string | null;
}

const JST_TIMEZONE = 'Asia/Tokyo';

export const AttendanceLogs: React.FC<AttendanceLogsProps> = ({ user }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [logs, setLogs] = useState<ProcessedLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const zonedCurrentMonth = utcToZonedTime(currentMonth, JST_TIMEZONE);
        const monthStart = startOfMonth(zonedCurrentMonth);
        const monthEnd = endOfMonth(zonedCurrentMonth);
        
        const fetchedLogs = await getUserAttendanceLogsV2(user.uid, monthStart, monthEnd, 1000);
        
        const logsByDate: { [key: string]: AttendanceLog[] } = {};
        fetchedLogs.forEach(log => {
          const logDate = safeTimestampToDate(log.timestamp);
          if (logDate) {
            const dateKey = formatInTimeZone(logDate, JST_TIMEZONE, 'yyyy-MM-dd');
            if (!logsByDate[dateKey]) {
              logsByDate[dateKey] = [];
            }
            logsByDate[dateKey].push(log);
          }
        });

        const processed: ProcessedLog[] = Object.keys(logsByDate).map(dateKey => {
          const dayLogs = logsByDate[dateKey];
          const entries = dayLogs.filter(l => l.type === 'entry').map(l => safeTimestampToDate(l.timestamp)).filter(Boolean) as Date[];
          const exits = dayLogs.filter(l => l.type === 'exit').map(l => safeTimestampToDate(l.timestamp)).filter(Boolean) as Date[];
          
          const checkInTime = entries.length > 0 ? new Date(Math.min(...entries.map(d => d.getTime()))) : null;
          const checkOutTime = exits.length > 0 ? new Date(Math.max(...exits.map(d => d.getTime()))) : null;
          
          let workDuration = null;
          if (checkInTime && checkOutTime && checkOutTime > checkInTime) {
            const minutes = differenceInMinutes(checkOutTime, checkInTime);
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            workDuration = `${hours}時間${remainingMinutes}分`;
          }

          return {
            date: dateKey,
            checkInTime,
            checkOutTime,
            workDuration,
          };
        }).sort((a, b) => b.date.localeCompare(a.date));

        setLogs(processed);

      } catch (error) {
        console.error('勤怠ログ取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user.uid, currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>月間出退勤履歴</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-lg w-32 text-center">
            {formatInTimeZone(currentMonth, JST_TIMEZONE, 'yyyy年 M月', { locale: ja })}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          この月の勤怠記録はありません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">出勤時間</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">退勤時間</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">滞在時間</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.date}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                     {formatInTimeZone(zonedTimeToUtc(log.date, JST_TIMEZONE), JST_TIMEZONE, 'MM/dd(E)', { locale: ja })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500 font-mono">
                    {log.checkInTime ? formatInTimeZone(log.checkInTime, JST_TIMEZONE, 'HH:mm') : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500 font-mono">
                    {log.checkOutTime ? formatInTimeZone(log.checkOutTime, JST_TIMEZONE, 'HH:mm') : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-500 font-mono">
                    {log.workDuration || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </CardContent>
    </Card>
  );
};
