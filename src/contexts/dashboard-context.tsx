'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getAllUsers } from '@/lib/data-adapter';
import type { AppUser, Team } from '@/types';
import type { DayStats, MonthlyData } from '@/hooks/use-attendance-data';


interface DashboardContextType {
  // キャッシュデータ
  monthlyCache: Record<string, Record<string, MonthlyData>>;
  setMonthlyCache: React.Dispatch<React.SetStateAction<Record<string, Record<string, MonthlyData>>>>;
  
  todayStats: DayStats[];
  setTodayStats: React.Dispatch<React.SetStateAction<DayStats[]>>;
  
  allUsers: AppUser[];
  setAllUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  
  allTeams: Team[];
  setAllTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  
  // ローディング状態
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  
  // データ取得関数
  clearCache: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [monthlyCache, setMonthlyCache] = useState<Record<string, Record<string, MonthlyData>>>({});
  const [todayStats, setTodayStats] = useState<DayStats[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 初期データの取得
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        console.log('DashboardProvider: Loading initial data...');
        
        // ユーザーデータを取得
        const users = await getAllUsers();
        console.log('DashboardProvider: Users loaded:', users.length);
        setAllUsers(users);
        
      } catch (error) {
        console.error('DashboardProvider: Failed to load initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const clearCache = useCallback(() => {
    setMonthlyCache({});
    setTodayStats([]);
    console.log('🗑️ ダッシュボードキャッシュをクリア');
  }, []);

  const value: DashboardContextType = {
    monthlyCache,
    setMonthlyCache,
    todayStats,
    setTodayStats,
    allUsers,
    setAllUsers,
    allTeams,
    setAllTeams,
    isLoading,
    setIsLoading,
    clearCache,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
