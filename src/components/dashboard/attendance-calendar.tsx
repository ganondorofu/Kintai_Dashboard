
'use client';

import { useState } from 'react';
import { CalendarHeader } from './calendar-header';
import { CalendarGrid } from './calendar-grid';
import { DayDetail } from './day-detail';
import { useAttendanceData } from '@/hooks/use-attendance-data';
import type { AppUser } from '@/types';
import type { DayStats } from '@/hooks/use-attendance-data';

interface AttendanceCalendarProps {
  currentUser: AppUser;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    monthlyLoading,
    fetchMonthlyData,
    fetchDayStats,
    getTotalAttendance
  } = useAttendanceData(currentDate);

  // 月ナビゲーション
  const handleNavigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // 選択状態をリセット
    setSelectedDate(null);
    setDayStats([]);
    
    // 日付を更新
    setCurrentDate(newDate);
  };

  // 日付クリック処理
  const handleDateClick = async (date: Date) => {
    // 即座にUIを更新（楽観的UI）
    setSelectedDate(date);
    
    // キャッシュから即座に表示を試行
    setLoading(true);
    setDayStats([]); // 前のデータをクリア
    
    try {
      const stats = await fetchDayStats(date);
      setDayStats(stats);
    } catch (error) {
      console.error('日別データ取得エラー:', error);
      setDayStats([]);
    } finally {
      setLoading(false);
    }
  };

  // ホバー時のプリロード（軽量化）
  const handleDateHover = (date: Date) => {
    // 軽量なプリロード処理（必要に応じて実装）
  };

  // データ再取得
  const handleRefresh = () => {
    fetchMonthlyData(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <CalendarHeader
          currentDate={currentDate}
          monthlyLoading={monthlyLoading}
          onNavigateMonth={handleNavigateMonth}
          onRefresh={handleRefresh}
        />

        <CalendarGrid
          currentDate={currentDate}
          onDateClick={handleDateClick}
          onDateHover={handleDateHover}
          getTotalAttendance={getTotalAttendance}
          selectedDate={selectedDate}
          monthlyLoading={monthlyLoading}
        />
      </div>

      {/* 選択日の詳細統計 */}
      {selectedDate && (
        <DayDetail
          selectedDate={selectedDate}
          dayStats={dayStats}
          loading={loading}
        />
      )}
    </div>
  );
};
