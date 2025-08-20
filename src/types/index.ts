import type { Timestamp } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  github: string;
  cardId: string;
  firstname: string;
  lastname: string;
  teamId: string;
  grade: number;
  role: 'user' | 'admin';
  createdAt: Timestamp;
}

export interface Team {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface AttendanceLog {
  id: string;
  uid: string;
  cardId: string;
  type: 'entry' | 'exit';
  timestamp: Timestamp;
}

export interface LinkRequest {
  id: string;
  token: string;
  cardId: string;
  status: 'waiting' | 'linked' | 'done';
  uid?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
