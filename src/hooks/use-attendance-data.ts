
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { 
  getDailyAttendanceStatsV2, 
  getWorkdaysInRange,
  getAllAttendanceLogs
} from '@/lib/data-adapter';
import type { AppUser } from '@/types';
import { useDashboard } from '@/contexts/dashboard-context';

export interface DayStats {
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: AppUser[] }[];
}

export interface MonthlyData {
  [date: string]: {
    totalCount: number;
  };
}

export const useAttendanceData = (currentDate: Date) => {
  const { setCacheStatus } = useDashboard();
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  
  const fetchMonthlyData = useCallback(async (forceRefresh: boolean = false) => {
    setMonthlyLoading(true);
    setCacheStatus('loading');
    
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      const logs = await getAllAttendanceLogs(monthStart, monthEnd, 5000);
      
      const dailyCounts: Record<string, Set<string>> = {};

      logs.forEach(log => {
        if (log.timestamp && log.type === 'entry') {
          const date = new Date(log.timestamp.seconds * 1000);
          const dateKey = date.toDateString();
          if (!dailyCounts[dateKey]) {
            dailyCounts[dateKey] = new Set();
          }
          dailyCounts[dateKey].add(log.uid);
        }
      });
      
      const newMonthlyData: MonthlyData = {};
      Object.keys(dailyCounts).forEach(dateKey => {
        newMonthlyData[dateKey] = {
          totalCount: dailyCounts[dateKey].size
        };
      });

      setMonthlyData(newMonthlyData);
      setCacheStatus('fresh');

    } catch (error) {
      console.error('❌ 月次データ取得エラー:', error);
      setCacheStatus('error');
      setMonthlyData({});
    } finally {
      setMonthlyLoading(false);
    }
  }, [currentDate, setCacheStatus]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  const fetchDayStats = useCallback(async (date: Date): Promise<DayStats[]> => {
    try {
      const stats = await getDailyAttendanceStatsV2(date);
      return stats;
      
    } catch (error) {
      console.error('日別統計取得エラー:', error);
      return [];
    }
  }, []);

  const getTotalAttendance = useCallback((date: Date): number => {
    const dateKey = date.toDateString();
    const dayData = monthlyData[dateKey];
    return dayData?.totalCount || 0;
  }, [monthlyData]);

  return {
    monthlyData,
    monthlyLoading,
    fetchMonthlyData,
    fetchDayStats,
    getTotalAttendance,
  };
};
