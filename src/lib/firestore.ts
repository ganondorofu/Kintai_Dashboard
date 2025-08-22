import { collection, getDocs, doc, getDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import type { Team, AppUser, AttendanceLog, Workday, Summary } from '@/types';

// チーム一覧を取得
export const getTeams = async (): Promise<Team[]> => {
  try {
    const teamsRef = collection(db, 'teams');
    const snapshot = await getDocs(teamsRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<Team, 'id'>
    } as Team));
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};

// 特定チームの情報を取得
export const getTeam = async (teamId: string): Promise<Team | null> => {
  try {
    const teamRef = doc(db, 'teams', teamId);
    const snapshot = await getDoc(teamRef);
    
    if (snapshot.exists()) {
      return {
        id: snapshot.id,
        ...snapshot.data() as Omit<Team, 'id'>
      } as Team;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching team:', error);
    throw error;
  }
};

// ユーザーの出勤履歴を取得
export const getUserAttendanceLogs = async (uid: string, limitCount: number = 50): Promise<AttendanceLog[]> => {
  try {
    const logsRef = collection(db, 'attendance_logs');
    const q = query(
      logsRef, 
      where('uid', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<AttendanceLog, 'id'>
    } as AttendanceLog));
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    throw error;
  }
};

// 全ユーザーの最新出勤状態を取得
export const getAllUsersLatestStatus = async (): Promise<Map<string, AttendanceLog>> => {
  try {
    const logsRef = collection(db, 'attendance_logs');
    const snapshot = await getDocs(logsRef);
    
    const userLatestLogs = new Map<string, AttendanceLog>();
    
    snapshot.docs.forEach(doc => {
      const log = { id: doc.id, ...doc.data() as Omit<AttendanceLog, 'id'> } as AttendanceLog;
      const existing = userLatestLogs.get(log.uid);
      
      if (!existing || log.timestamp.seconds > existing.timestamp.seconds) {
        userLatestLogs.set(log.uid, log);
      }
    });
    
    return userLatestLogs;
  } catch (error) {
    console.error('Error fetching latest attendance status:', error);
    throw error;
  }
};

// チームメンバー一覧を取得
export const getTeamMembers = async (teamId: string): Promise<AppUser[]> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('teamId', '==', teamId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data() as Omit<AppUser, 'uid'>
    } as AppUser));
  } catch (error) {
    console.error('Error fetching team members:', error);
    throw error;
  }
};

// 全ユーザー一覧を取得（管理者用）
export const getAllUsers = async (): Promise<AppUser[]> => {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data() as Omit<AppUser, 'uid'>
    } as AppUser));
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

// 労働日の管理（既存システム互換）
export const getWorkdays = async (): Promise<Workday[]> => {
  try {
    const workdaysRef = collection(db, 'workdays');
    const q = query(workdaysRef, orderBy('date', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<Workday, 'id'>
    } as Workday));
  } catch (error) {
    console.error('Error fetching workdays:', error);
    throw error;
  }
};

// 月次サマリーの取得（既存システム互換）
export const getMonthlySummary = async (year: number, month: number): Promise<Summary | null> => {
  try {
    const summaryId = `workdays_${year}_${month.toString().padStart(2, '0')}`;
    const summaryRef = doc(db, 'summary', summaryId);
    const snapshot = await getDoc(summaryRef);
    
    if (snapshot.exists()) {
      return {
        id: snapshot.id,
        ...snapshot.data() as Omit<Summary, 'id'>
      } as Summary;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    throw error;
  }
};
