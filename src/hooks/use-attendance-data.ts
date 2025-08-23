
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  getDailyAttendanceStatsV2, 
  calculateMonthlyAttendanceStatsWithCacheV2, 
  invalidateMonthlyCache 
} from '@/lib/data-adapter';
import type { AppUser } from '@/types';
import { useDashboard } from '@/contexts/dashboard-context';

export interface DayStats {
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: AppUser[] }[];
}

export interface MonthlyData {
  totalCount: number;
  teamStats: DayStats[];
}

export const useAttendanceData = (currentDate: Date) => {
  const { monthlyCache, setMonthlyCache, setCacheStatus, cacheStatus } = useDashboard();
  const [monthlyData, setMonthlyData] = useState<Record<string, MonthlyData>>({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  
  // 現在の月のキー生成
  const getCurrentMonthKey = useCallback((date: Date = currentDate) => {
    return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
  }, [currentDate]);

  // 月次データを取得する関数
  const fetchMonthlyData = useCallback(async (forceRefresh: boolean = false) => {
    const monthKey = getCurrentMonthKey();
    
    // キャッシュがあれば先に表示
    if (monthlyCache[monthKey] && !forceRefresh) {
      console.log('💾 キャッシュから即座に取得:', monthKey);
      setMonthlyData(monthlyCache[monthKey]);
      setCacheStatus('cached'); // まずキャッシュから表示したことを示す
    }

    setMonthlyLoading(true);
    // キャッシュがあっても通信は行うのでloadingにする
    setCacheStatus(prev => (prev === 'cached' ? 'loading' : 'loading'));
    
    try {
      console.log('📊 月次データを取得中...', format(currentDate, 'yyyy年MM月'));
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      if (forceRefresh) {
        await invalidateMonthlyCache(year, month);
      }
      
      const startTime = Date.now();
      const monthlyStats = await calculateMonthlyAttendanceStatsWithCacheV2(year, month);
      const endTime = Date.now();
      
      const convertedData: Record<string, MonthlyData> = {};
      Object.entries(monthlyStats).forEach(([dateKey, stats]) => {
        convertedData[dateKey] = {
          totalCount: stats.totalCount,
          teamStats: stats.teamStats
        };
      });
      
      setMonthlyData(convertedData);
      
      setMonthlyCache(prev => ({
        ...prev,
        [monthKey]: convertedData
      }));
      
      setCacheStatus('fresh');
      console.log(`✅ 新データ構造: ${Object.keys(convertedData).length}日分 (${endTime - startTime}ms)`);

    } catch (error) {
      console.error('❌ 月次データ取得エラー:', error);
      setCacheStatus('error');
      // エラーが発生しても、古いキャッシュがあればそれを表示し続ける
      if (!monthlyCache[monthKey]) {
        setMonthlyData({});
      }
    } finally {
      setMonthlyLoading(false);
    }
  }, [currentDate, getCurrentMonthKey, monthlyCache, setMonthlyCache, setCacheStatus]);

  // 月が変わったら月次データを取得
  useEffect(() => {
    fetchMonthlyData();
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  // 日別統計を取得
  const fetchDayStats = useCallback(async (date: Date): Promise<DayStats[]> => {
    try {
      const dateKey = date.toDateString();
      const monthlyDayData = monthlyData[dateKey];
      
      if (monthlyDayData && monthlyDayData.teamStats) {
        return monthlyDayData.teamStats;
      }

      const stats = await getDailyAttendanceStatsV2(date);
      return stats;
      
    } catch (error) {
      console.error('日別統計取得エラー:', error);
      return [];
    }
  }, [monthlyData]);

  // 特定日の出席者数を取得
  const getTotalAttendance = useCallback((date: Date): number => {
    const dateKey = date.toDateString();
    const monthlyDayData = monthlyData[dateKey];
    return monthlyDayData?.totalCount || 0;
  }, [monthlyData]);

  return {
    monthlyData,
    monthlyLoading,
    fetchMonthlyData,
    fetchDayStats,
    getTotalAttendance,
  };
};
