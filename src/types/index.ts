

import type { Timestamp } from 'firebase/firestore';

export interface AppUser {
  uid: string;              // Firebase Auth UID
  github: string;
  githubLogin?: string;
  githubId?: number;
  name?: string;
  avatarUrl?: string;
  cardId?: string;
  firstname: string;
  lastname: string;
  teamId?: string;
  grade: number;
  role?: 'user' | 'admin';
  lastLoginAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  status?: 'active' | 'inactive';
  last_activity?: Timestamp;
}

export interface Team {
  id: string;
  name: string;
  leaderUid?: string;
  createdAt?: Timestamp;
}

export interface AttendanceLog {
  id?: string;
  uid: string;
  cardId?: string;
  type: 'entry' | 'exit';
  timestamp: Timestamp;
}

export interface LinkRequest {
  id?: string;
  token: string;
  cardId?: string;
  status: 'waiting' | 'opened' | 'linked' | 'done';
  uid?: string;
  github?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 既存システムにある追加コレクション
export interface Workday {
  id?: string;
  date: string;
  createdAt: Timestamp;
}

export interface Summary {
  id?: string;
  totalDays: number;
  updatedAt: Timestamp;
}

// 月次出席統計キャッシュ
export interface MonthlyAttendanceCache {
  id?: string;
  year: number;
  month: number;
  dailyStats: Record<string, {
    date: string;
    totalCount: number;
    teamStats: {
      teamId: string;
      teamName: string;
      gradeStats: {
        grade: number;
        count: number;
        userIds: string[];
      }[];
    }[];
  }>;
  lastCalculated: Timestamp;
  lastLogCount: number;
  dataHash: string;
}

export type CacheStatus = 'idle' | 'loading' | 'cached' | 'fresh' | 'error';

export interface CronSettings {
  forceClockOutStartTime?: string; // HH:mm format
  forceClockOutEndTime?: string; // HH:mm format
  updatedAt?: Timestamp;
}

export interface ApiCallLog {
  id?: string;
  apiEndpoint: string;
  timestamp: Timestamp;
  completedAt?: Timestamp;
  status: 'running' | 'success' | 'error' | 'skipped';
  result?: Record<string, any>;
}
