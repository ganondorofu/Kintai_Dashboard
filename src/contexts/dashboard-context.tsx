
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllUsers, getAllTeams } from '@/lib/data-adapter';
import type { AppUser, Team } from '@/types';

interface DashboardContextType {
  allUsers: AppUser[];
  allTeams: Team[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInitialData = async () => {
    setIsLoading(true);
    console.log('DashboardProvider: Loading initial data...');
    try {
      const [users, teams] = await Promise.all([
        getAllUsers(),
        getAllTeams()
      ]);
      setAllUsers(users);
      setAllTeams(teams);
      console.log(`DashboardProvider: Loaded ${users.length} users and ${teams.length} teams.`);
    } catch (error) {
      console.error('DashboardProvider: Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const value: DashboardContextType = {
    allUsers,
    allTeams,
    isLoading,
    refreshData: loadInitialData,
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
