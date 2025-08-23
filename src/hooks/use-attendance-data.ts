
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
    
    // キャッシュチェック
    if (!forceRefresh && monthlyCache[monthKey]) {
      console.log('💾 キャッシュから即座に取得:', monthKey);
      setMonthlyData(monthlyCache[monthKey]);
      setCacheStatus('cached');
      setMonthlyLoading(false);
      return;
    }

    setMonthlyLoading(true);
    setCacheStatus('loading');
    
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
      
      // MonthlyData形式に変換
      const convertedData: Record<string, MonthlyData> = {};
      Object.entries(monthlyStats).forEach(([dateKey, stats]) => {
        convertedData[dateKey] = {
          totalCount: stats.totalCount,
          teamStats: stats.teamStats
        };
      });
      
      setMonthlyData(convertedData);
      
      // キャッシュに保存
      setMonthlyCache(prev => ({
        ...prev,
        [monthKey]: convertedData
      }));
      
      setCacheStatus('fresh'); // Fetched fresh data
      console.log(`✅ 新データ構造: ${Object.keys(convertedData).length}日分 (${endTime - startTime}ms)`);

    } catch (error) {
      console.error('❌ 月次データ取得エラー:', error);
      setMonthlyData({});
      setCacheStatus('error');
    } finally {
      setMonthlyLoading(false);
    }
  }, [currentDate, getCurrentMonthKey, monthlyCache, setMonthlyCache, setCacheStatus]);

  // 月が変わったら月次データを取得
  useEffect(() => {
    const monthKey = getCurrentMonthKey();
    
    if (monthlyCache[monthKey]) {
      console.log('🏃‍♂️ 月切り替え - キャッシュから即座にロード:', monthKey);
      setMonthlyData(monthlyCache[monthKey]);
      setCacheStatus('cached');
      setMonthlyLoading(false);
    } else {
      console.log('📥 月切り替え - 新規取得が必要:', monthKey);
      fetchMonthlyData();
    }
  }, [currentDate.getFullYear(), currentDate.getMonth(), fetchMonthlyData, getCurrentMonthKey, monthlyCache, setCacheStatus]);

  // 日別統計を取得
  const fetchDayStats = useCallback(async (date: Date): Promise<DayStats[]> => {
    try {
      // 月次データから取得を試行
      const dateKey = date.toDateString();
      const monthlyDayData = monthlyData[dateKey];
      
      if (monthlyDayData && monthlyDayData.teamStats) {
        console.log('✅ 月次キャッシュから高速取得:', dateKey);
        return monthlyDayData.teamStats;
      }

      // キャッシュにない場合：バックグラウンドで単日計算
      console.log('⚡ バックグラウンドで単日計算:', dateKey);
      const stats = await getDailyAttendanceStatsV2(date);
      
      // 取得したデータを月次キャッシュに追加
      setMonthlyData(prev => ({
        ...prev,
        [dateKey]: {
          totalCount: stats.reduce((total, team) => 
            total + (team.gradeStats ? team.gradeStats.reduce((teamTotal, grade) => teamTotal + (grade.count || 0), 0) : 0), 0
          ),
          teamStats: stats
        }
      }));
      
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
    cacheStatus,
    fetchMonthlyData,
    fetchDayStats,
    getTotalAttendance,
    monthlyCache
  };
};
