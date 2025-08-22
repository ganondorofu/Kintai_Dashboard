

import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc, query, where, onSnapshot, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, AttendanceLog, LinkRequest, Team, MonthlyAttendanceCache } from '@/types';
import type { GitHubUser } from './oauth';
import type { User as FirebaseUser } from 'firebase/auth';

/**
 * 既存のFirestoreデータ構造とOAuth認証を統合するためのアダプター
 * 
 * 重要な発見：旧プロジェクトの構成
 * - プロジェクトA（認証用）: Firebase Auth + GitHub OAuth
 * - プロジェクトB（データ用）: Firestore のみ（Firebase Auth設定なし）
 * - UID: Firebase Auth UID（28文字）をプロジェクト間で共有
 * 
 * 移行戦略：
 * - 既存のFirebase Auth UIDを保持
 * - GitHubアカウント名で既存ユーザーを特定
 * - 同じUIDで新しい認証システムからアクセス
 */

// timestamp を安全に Date オブジェクトに変換するヘルパー関数
// 旧プロジェクトでは new Date() で保存され、Firestore Timestamp として読み取られる
const safeTimestampToDate = (timestamp: any): Date | null => {
  try {
    if (timestamp && typeof timestamp.toDate === 'function') {
      // Firestore Timestamp（最も一般的なケース）
      // 旧プロジェクト: new Date() → Firestore Timestamp
      return timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // 既にDateオブジェクト（直接作成された場合）
      return timestamp;
    } else if (timestamp && typeof timestamp === 'string') {
      // 文字列の場合（ISO文字列など）
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    } else if (timestamp && typeof timestamp === 'number') {
      // Unix timestamp（ミリ秒）
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    } else if (timestamp && timestamp._seconds !== undefined) {
      // Firestore Timestampの内部構造が露出している場合
      // _seconds と _nanoseconds プロパティを持つオブジェクト
      return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
    } else {
      console.warn('無効なtimestamp形式:', timestamp);
      return null;
    }
  } catch (error) {
    console.error('timestamp変換エラー:', error, timestamp);
    return null;
  }
};

// 新しいデータ構造用のヘルパー関数
const getAttendancePath = (date: Date): { year: string, month: string, day: string, fullPath: string } => {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return {
    year,
    month,
    day,
    fullPath: `${year}/${month}/${day}`
  };
};

// 日付範囲から年月のリストを生成
const getYearMonthsInRange = (startDate: Date, endDate: Date): { year: string, month: string }[] => {
  const yearMonths: { year: string, month: string }[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  
  while (current <= end) {
    const year = current.getFullYear().toString();
    const month = (current.getMonth() + 1).toString().padStart(2, '0');
    yearMonths.push({ year, month });
    current.setMonth(current.getMonth() + 1);
  }
  
  return yearMonths;
};

// 期生から学年への変換ヘルパー関数
// 2025年時点: 8期生=3年生, 9期生=2年生, 10期生=1年生
const convertKiseiiToGrade = (kiseiNumber: number, currentYear: number = new Date().getFullYear()): number => {
  // 基準年（2025年）における期生と学年の対応
  const baseYear = 2025;
  const baseKiseiToGrade: Record<number, number> = {
    8: 3,  // 8期生 = 3年生
    9: 2,  // 9期生 = 2年生
    10: 1, // 10期生 = 1年生
  };

  // 年が変わった場合の調整
  const yearDifference = currentYear - baseYear;
  
  if (baseKiseiToGrade[kiseiNumber]) {
    const adjustedGrade = baseKiseiToGrade[kiseiNumber] + yearDifference;
    // 学年は1-3の範囲内に制限
    return Math.max(1, Math.min(3, adjustedGrade));
  }

  // 基準データにない場合の推定計算
  // 10期生を基準として、期生が1つ下がると学年が1つ上がる
  const baseKisei = 10; // 10期生 = 1年生（2025年基準）
  const estimatedGrade = 1 + (baseKisei - kiseiNumber) + yearDifference;
  
  return Math.max(1, Math.min(3, estimatedGrade));
};

// 全ユーザー一覧を取得（管理者専用）
export const getAllUsers = async (): Promise<AppUser[]> => {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    } as AppUser));
  } catch (error) {
    console.error('全ユーザー取得エラー:', error);
    return [];
  }
};

// チーム一覧を取得（重複を許容しないように修正）
export const getAllTeams = async (): Promise<Team[]> => {
  try {
    const teamsRef = collection(db, 'teams');
    const snapshot = await getDocs(teamsRef);
    
    // IDの重複を排除
    const teamMap = new Map<string, Team>();
    snapshot.docs.forEach(doc => {
      const team = {
        id: doc.id,
        ...doc.data() as Omit<Team, 'id'>
      } as Team;
      teamMap.set(doc.id, team);
    });
    
    return Array.from(teamMap.values());
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};


// ログデータから直接出席統計を計算するヘルパー関数
const calculateDailyAttendanceFromLogs = async (
  targetDate: Date
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: AppUser[] }[];
}[]> => {
  try {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 指定日の出勤記録があるログを取得
    const logsRef = collection(db, 'attendance_logs');
    const q = query(
      logsRef,
      where('timestamp', '>=', startOfDay),
      where('timestamp', '<=', endOfDay),
      where('type', '==', 'entry')
    );
    
    const snapshot = await getDocs(q);
    const dayEntryLogs = snapshot.docs.map(doc => doc.data() as AttendanceLog);
    
    // 出席したユーザーのUIDを取得（重複排除）
    const attendedUids = [...new Set(dayEntryLogs.map(log => log.uid))];
    
    if (attendedUids.length === 0) {
      return [];
    }

    // 全ユーザー情報を取得
    const allUsers = await getAllUsers();
    
    // 出席したユーザーの情報を取得
    const attendedUsers = allUsers.filter(user => attendedUids.includes(user.uid));

    // 班ごとにグループ化
    const teamGroups = attendedUsers.reduce((acc, user) => {
      const teamId = user.teamId || 'unassigned';
      if (!acc[teamId]) {
        acc[teamId] = [];
      }
      acc[teamId].push(user);
      return acc;
    }, {} as Record<string, AppUser[]>);

    // チーム情報を取得
    const teams = await getAllTeams();
    const teamMap = teams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {} as Record<string, string>);

    // 結果を構築
    return Object.entries(teamGroups).map(([teamId, users]) => {
      // 学年ごとにグループ化（期生を学年に変換）
      const gradeGroups = users.reduce((acc, user) => {
        const kiseiNumber = user.grade || 10; // デフォルトは10期生
        const actualGrade = convertKiseiiToGrade(kiseiNumber);
        if (!acc[actualGrade]) {
          acc[actualGrade] = [];
        }
        acc[actualGrade].push(user);
        return acc;
      }, {} as Record<number, AppUser[]>);

      const gradeStats = Object.entries(gradeGroups).map(([gradeStr, gradeUsers]) => ({
        grade: parseInt(gradeStr),
        count: gradeUsers.length,
        users: gradeUsers.map(u => ({ ...u, isPresent: true }))
      })).sort((a, b) => b.grade - a.grade); // 学年の降順

      return {
        teamId,
        teamName: teamMap[teamId],
        gradeStats
      };
    });
  } catch (error) {
    console.error('ログデータからの統計計算エラー:', error);
    return [];
  }
};


// ログデータから直接出席統計を計算するヘルパー関数
const calculateDailyAttendanceFromLogsData = async (
  logs: AttendanceLog[],
  targetDate: Date
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: AppUser[] }[];
}[]> => {
  try {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 指定日の出勤記録があるユーザーを特定
    const dayEntryLogs = logs.filter(log => {
      const logDate = safeTimestampToDate(log.timestamp);
      if (!logDate) return false;
      
      return logDate >= startOfDay && 
             logDate <= endOfDay && 
             log.type === 'entry';
    });
    
    // 出席したユーザーのUIDを取得（重複排除）
    const attendedUids = [...new Set(dayEntryLogs.map(log => log.uid))];
    
    if (attendedUids.length === 0) {
      return [];
    }

    // 全ユーザー情報を取得
    const allUsers = await getAllUsers();
    
    // 出席したユーザーの情報を取得
    const attendedUsers = allUsers.filter(user => attendedUids.includes(user.uid));

    // 班ごとにグループ化
    const teamGroups = attendedUsers.reduce((acc, user) => {
      const teamId = user.teamId || 'unassigned';
      if (!acc[teamId]) {
        acc[teamId] = [];
      }
      acc[teamId].push(user);
      return acc;
    }, {} as Record<string, AppUser[]>);

    // チーム情報を取得
    const teams = await getAllTeams();
    const teamMap = teams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {} as Record<string, string>);

    // 結果を構築
    return Object.entries(teamGroups).map(([teamId, users]) => {
      // 学年ごとにグループ化（期生を学年に変換）
      const gradeGroups = users.reduce((acc, user) => {
        const kiseiNumber = user.grade || 10; // デフォルトは10期生
        const actualGrade = convertKiseiiToGrade(kiseiNumber);
        if (!acc[actualGrade]) {
          acc[actualGrade] = [];
        }
        acc[actualGrade].push(user);
        return acc;
      }, {} as Record<number, AppUser[]>);

      const gradeStats = Object.entries(gradeGroups).map(([gradeStr, gradeUsers]) => ({
        grade: parseInt(gradeStr),
        count: gradeUsers.length,
        users: gradeUsers
      })).sort((a, b) => b.grade - a.grade); // 学年の降順

      return {
        teamId,
        teamName: teamMap[teamId],
        gradeStats
      };
    });
  } catch (error) {
    console.error('ログデータからの統計計算エラー:', error);
    return [];
  }
};



// 期生データを学年表示用に変換する関数
export const formatKiseiAsGrade = (kiseiNumber: number): string => {
  const grade = convertKiseiiToGrade(kiseiNumber);
  return `${grade}年生（${kiseiNumber}期生）`;
};

// 期生データのみを表示する関数
export const formatKisei = (kiseiNumber: number): string => {
  return `${kiseiNumber}期生`;
};

// GitHubアカウント名で既存ユーザーを検索
const findUserByGitHub = async (githubLogin: string): Promise<AppUser | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('github', '==', githubLogin));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        uid: doc.id,  // 既存のFirebase Auth UIDをそのまま使用
        ...doc.data() as Omit<AppUser, 'uid'>
      } as AppUser;
    }
    
    return null;
  } catch (error) {
    console.error('GitHub名でのユーザー検索エラー:', error);
    return null;
  }
};

// Firebase Auth Userを既存のAppUserと統合
export const integrateFirebaseUser = async (firebaseUser: FirebaseUser): Promise<AppUser | null> => {
  try {
    // Firebase Auth UIDで既存ユーザーを検索
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnapshot = await getDoc(userRef);
    
    if (userSnapshot.exists()) {
      // 既存のユーザーが見つかった場合
      const existingData = userSnapshot.data() as AppUser;
      const updatedUser: AppUser = {
        ...existingData,
        uid: firebaseUser.uid,  // Firebase Auth UID
        lastLoginAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      // 最終ログイン時刻を更新
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return updatedUser;
    } else {
      // 新規ユーザーの場合は基本データを作成
      // GitHubアカウント情報をFirebase Authから取得
      const providerData = firebaseUser.providerData.find(p => p.providerId === 'github.com');
      const githubUsername = providerData?.uid || firebaseUser.displayName || 'unknown';
      
      const newUser: AppUser = {
        uid: firebaseUser.uid,  // Firebase Auth UID
        github: githubUsername,
        firstname: firebaseUser.displayName?.split(' ')[0] || githubUsername,
        lastname: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        grade: 1, // デフォルト値
        createdAt: Timestamp.now(),
        lastLoginAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      await setDoc(userRef, {
        ...newUser,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return newUser;
    }
  } catch (error) {
    console.error('Firebaseユーザー統合エラー:', error);
    return null;
  }
};

// 出勤記録を作成（新しいデータ構造）
export const createAttendanceLogV2 = async (
  uid: string, 
  type: 'entry' | 'exit',
  cardId?: string
): Promise<boolean> => {
  try {
    // 旧構造と同じID生成規則を使用
    const logId = `${uid}_${Date.now()}`;
    return await createAttendanceLogV2WithId(uid, type, cardId, logId);
  } catch (error) {
    console.error('新しい出勤記録作成エラー:', error);
    return false;
  }
};

// 出勤記録を作成（新しいデータ構造、ID指定版）
export const createAttendanceLogV2WithId = async (
  uid: string, 
  type: 'entry' | 'exit',
  cardId: string | undefined,
  logId: string
): Promise<boolean> => {
  try {
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    
    // 新しい階層構造に保存: /attendances/{年月日}/logs/{logId}
    // 旧構造と同じIDを使用
    const dateKey = `${year}-${month}-${day}`;
    const logRef = doc(db, 'attendances', dateKey, 'logs', logId);
    
    const logData: Omit<AttendanceLog, 'id'> = {
      uid,
      type,
      timestamp: Timestamp.now(),
      cardId: cardId || ''
    };
    
    await setDoc(logRef, {
      ...logData,
      timestamp: serverTimestamp()
    });
    
    console.log('新しい出勤記録を作成:', { dateKey, logId, type });
    return true;
  } catch (error) {
    console.error('新しい出勤記録作成エラー:', error);
    return false;
  }
};

// ユーザーの勤怠記録を取得（新しいデータ構造）
export const getUserAttendanceLogsV2 = async (
  uid: string, 
  startDate?: Date, 
  endDate?: Date,
  limitCount: number = 50
): Promise<AttendanceLog[]> => {
  try {
    const logs: AttendanceLog[] = [];
    
    if (startDate && endDate) {
      // 日付範囲が指定されている場合、該当する年月のコレクションを検索
      const yearMonths = getYearMonthsInRange(startDate, endDate);
      
      for (const { year, month } of yearMonths) {
        // その月のすべての日をチェック
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
          const dayStr = day.toString().padStart(2, '0');
          const dateKey = `${year}-${month}-${dayStr}`;
          const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');
          
          const q = query(
            dayLogsRef,
            where('uid', '==', uid),
            where('timestamp', '>=', startDate),
            where('timestamp', '<=', endDate),
            orderBy('timestamp', 'desc')
          );
          
          const daySnapshot = await getDocs(q);
          const dayLogs = daySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as AttendanceLog));
          
          logs.push(...dayLogs);
        }
      }
      
      // 日付でソートしてlimitを適用
      logs.sort((a, b) => {
        const aTime = safeTimestampToDate(a.timestamp)?.getTime() || 0;
        const bTime = safeTimestampToDate(b.timestamp)?.getTime() || 0;
        return bTime - aTime; // 降順
      });
      
      return logs.slice(0, limitCount);
    } else {
      // 日付範囲が指定されていない場合は、従来のattendance_logsからも取得
      return await getUserAttendanceLogs(uid, startDate, endDate, limitCount);
    }
  } catch (error) {
    console.error('新しい勤怠ログ取得エラー:', error);
    // フォールバック: 従来のデータ構造から取得
    return await getUserAttendanceLogs(uid, startDate, endDate, limitCount);
  }
};

// ユーザーの勤怠記録を取得（従来版）
export const getUserAttendanceLogs = async (
  uid: string, 
  startDate?: Date, 
  endDate?: Date,
  limitCount: number = 50
): Promise<AttendanceLog[]> => {
  try {
    const logsRef = collection(db, 'attendance_logs');
    let q = query(
      logsRef, 
      where('uid', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (startDate && endDate) {
      q = query(
        logsRef,
        where('uid', '==', uid),
        where('timestamp', '>=', startDate),
        where('timestamp', '<=', endDate),
        orderBy('timestamp', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
  } catch (error) {
    console.error('ユーザー勤怠ログ取得エラー:', error);
    return [];
  }
};

// 全ユーザーの勤怠記録を取得（管理者専用）
export const getAllAttendanceLogs = async (
  startDate?: Date,
  endDate?: Date,
  limitCount: number = 200
): Promise<AttendanceLog[]> => {
  try {
    const logsRef = collection(db, 'attendance_logs');
    let q = query(
      logsRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (startDate && endDate) {
      q = query(
        logsRef,
        where('timestamp', '>=', startDate),
        where('timestamp', '<=', endDate),
        orderBy('timestamp', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
  } catch (error) {
    console.error('全勤怠ログ取得エラー:', error);
    return [];
  }
};

// 月次の日別出席統計を一括計算
export const calculateMonthlyAttendanceStats = async (
  year: number,
  month: number // 0-11 (JavaScriptの月表記)
): Promise<Record<string, { totalCount: number; teamStats: any[] }>> => {
  try {
    console.log(`📅 ${year}年${month + 1}月の月次統計を計算中...`);
    
    // 月の最初と最後の日を取得
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0); // 翌月の0日 = 当月の最終日
    
    console.log(`📆 期間: ${monthStart.toDateString()} ~ ${monthEnd.toDateString()}`);

    // 全勤怠ログを取得（月範囲内）
    const allLogs = await getAllAttendanceLogs();
    console.log(`📊 全勤怠ログ数: ${allLogs.length}`);
    
    // 月内の出勤記録のみフィルタリング
    const monthLogs = allLogs.filter(log => {
      const logDate = safeTimestampToDate(log.timestamp);
      if (!logDate) return false;
      
      return logDate >= monthStart && 
             logDate <= monthEnd && 
             log.type === 'entry';
    });
    
    console.log(`📝 ${year}年${month + 1}月の出勤記録数: ${monthLogs.length}`);
    
    // 全ユーザー情報を取得
    const allUsers = await getAllUsers();
    console.log(`👤 全ユーザー数: ${allUsers.length}`);
    
    // 全チーム情報を取得
    const allTeams = await getAllTeams();
    const teamMap = allTeams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {} as Record<string, string>);
    
    // 日別にグループ化
    const dailyStats: Record<string, { totalCount: number; teamStats: any[] }> = {};
    
    // 月の各日について処理
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const targetDate = new Date(year, month, day);
      const dateKey = targetDate.toDateString();
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // その日の出勤記録を取得
      const dayLogs = monthLogs.filter(log => {
        const logDate = safeTimestampToDate(log.timestamp);
        if (!logDate) return false;
        
        return logDate >= startOfDay && logDate <= endOfDay;
      });
      
      // 出席したユーザーのUIDを取得（重複排除）
      const attendedUids = [...new Set(dayLogs.map(log => log.uid))];
      
      if (attendedUids.length === 0) {
        dailyStats[dateKey] = { totalCount: 0, teamStats: [] };
        continue;
      }
      
      // 出席したユーザーの情報を取得
      const attendedUsers = allUsers.filter(user => attendedUids.includes(user.uid));
      
      // 班ごとにグループ化
      const teamGroups = attendedUsers.reduce((acc, user) => {
        const teamId = user.teamId || 'unassigned';
        if (!acc[teamId]) {
          acc[teamId] = [];
        }
        acc[teamId].push(user);
        return acc;
      }, {} as Record<string, AppUser[]>);
      
      // 班別・学年別統計を生成
      const teamStats = Object.entries(teamGroups).map(([teamId, teamUsers]) => {
        const gradeGroups = teamUsers.reduce((acc, user) => {
          // user.gradeは期生として保存されているため、学年に変換
          const kiseiNumber = user.grade || 10; // デフォルトは10期生（1年生）
          const actualGrade = convertKiseiiToGrade(kiseiNumber);
          
          if (!acc[actualGrade]) {
            acc[actualGrade] = [];
          }
          acc[actualGrade].push(user);
          return acc;
        }, {} as Record<number, AppUser[]>);

        const gradeStats = Object.entries(gradeGroups).map(([grade, gradeUsers]) => ({
          grade: parseInt(grade),
          kisei: gradeUsers[0]?.grade || 10, // 期生情報も保持
          count: gradeUsers.length,
          users: gradeUsers
        })).sort((a, b) => a.grade - b.grade);

        return {
          teamId,
          teamName: teamMap[teamId] || `班${teamId}`,
          gradeStats
        };
      });
      
      const totalCount = teamStats.reduce((total, team) => 
        total + team.gradeStats.reduce((teamTotal, grade) => teamTotal + grade.count, 0), 0
      );
      
      dailyStats[dateKey] = { totalCount, teamStats };
      
      if (totalCount > 0) {
        console.log(`${dateKey}: ${totalCount}人`);
      }
    }
    
    const totalDaysWithAttendance = Object.values(dailyStats).filter(d => d.totalCount > 0).length;
    console.log(`🎊 ${year}年${month + 1}月統計計算完了: ${totalDaysWithAttendance}日間に出席記録`);
    
    return dailyStats;
  } catch (error) {
    console.error('月次出席統計計算エラー:', error);
    return {};
  }
};

// 特定日の班別・学年別出席人数を取得（従来版）
export const getDailyAttendanceStats = async (
  targetDate: Date
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: AppUser[] }[];
}[]> => {
  return calculateDailyAttendanceFromLogs(targetDate);
};


// 特定日の班別・学年別出席人数を取得（新しいデータ構造）
export const getDailyAttendanceStatsV2 = async (
  targetDate: Date
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: AppUser[] }[];
}[]> => {
  try {
    const { year, month, day } = getAttendancePath(targetDate);
    
    // 新しいデータ構造から取得を試行: /attendances/{年月日}/logs
    const dateKey = `${year}-${month}-${day}`;
    const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');
    const snapshot = await getDocs(dayLogsRef);
    
    if (snapshot.empty) {
      // 新しいデータ構造にデータがない場合は従来版にフォールバック
      console.log('新しいデータ構造にデータがありません。従来版を使用:', dateKey);
      return await getDailyAttendanceStats(targetDate);
    }
    
    console.log('新しいデータ構造から統計を計算:', dateKey, snapshot.size, '件');
    
    // 新しいデータ構造から統計を計算
    const logs: AttendanceLog[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
    
    return await calculateDailyAttendanceFromLogsData(logs, targetDate);
  } catch (error) {
    console.error('新しい日別統計取得エラー:', error);
    // エラー時は従来版にフォールバック
    return await getDailyAttendanceStats(targetDate);
  }
};



// ユーザー情報を更新（管理者専用）
export const updateUser = async (uid: string, updates: Partial<AppUser>): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    return false;
  }
};

// チームを作成（管理者専用）
export const createTeam = async (teamData: Omit<Team, 'id'>): Promise<string | null> => {
  try {
    const docRef = await addDoc(collection(db, 'teams'), {
      ...teamData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('チーム作成エラー:', error);
    return null;
  }
};

// チーム情報を更新（管理者専用）
export const updateTeam = async (teamId: string, updates: Partial<Team>): Promise<boolean> => {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('チーム更新エラー:', error);
    return false;
  }
};

/**
 * 月次の出席統計を計算する
 * @param logs 出席ログ配列
 * @param year 年
 * @param month 月（1-12）
 * @returns 日別の統計データ
 */
export const calculateMonthlyAttendanceStatsFromLogs = (logs: AttendanceLog[], year: number, month: number): Record<string, { date: string; attendeeCount: number; attendeeIds: string[] }> => {
  console.log('calculateMonthlyAttendanceStatsFromLogs - 開始:', { year, month, logsCount: logs.length });
  
  const stats: Record<string, { date: string; attendeeCount: number; attendeeIds: string[] }> = {};
  
  // 指定月のログをフィルタリング
  const monthLogs = logs.filter(log => {
    const logDate = safeTimestampToDate(log.timestamp);
    if (!logDate) return false;
    
    return logDate.getFullYear() === year && 
           logDate.getMonth() === month - 1; // getMonth()は0ベース
  });
  
  console.log('calculateMonthlyAttendanceStatsFromLogs - 月次ログ:', { filteredCount: monthLogs.length });
  
  // 日別にグループ化
  monthLogs.forEach(log => {
    const logDate = safeTimestampToDate(log.timestamp);
    if (!logDate) return;
    
    const dateKey = `${year}-${month.toString().padStart(2, '0')}-${logDate.getDate().toString().padStart(2, '0')}`;
    
    if (!stats[dateKey]) {
      stats[dateKey] = {
        date: dateKey,
        attendeeCount: 0,
        attendeeIds: []
      };
    }
    
    // 重複チェック（同じユーザーが同じ日に複数回打刻した場合）
    if (!stats[dateKey].attendeeIds.includes(log.uid)) {
      stats[dateKey].attendeeIds.push(log.uid);
      stats[dateKey].attendeeCount++;
    }
  });
  
  console.log('calculateMonthlyAttendanceStatsFromLogs - 結果:', stats);
  return stats;
};

// データ変更検知用のハッシュ生成
const generateDataHash = (logs: AttendanceLog[], users: AppUser[]): string => {
  const data = {
    logCount: logs.length,
    userCount: users.length,
    lastLogTimestamp: logs[0]?.timestamp?.toString() || '',
  };
  return btoa(JSON.stringify(data));
};

// 月次統計キャッシュの取得
const getMonthlyCache = async (year: number, month: number): Promise<MonthlyAttendanceCache | null> => {
  try {
    const cacheId = `attendance_stats_${year}_${String(month + 1).padStart(2, '0')}`;
    const cacheRef = doc(db, 'monthly_attendance_cache', cacheId);
    const cacheDoc = await getDoc(cacheRef);
    
    if (cacheDoc.exists()) {
      return { id: cacheDoc.id, ...cacheDoc.data() } as MonthlyAttendanceCache;
    }
    return null;
  } catch (error) {
    console.error('キャッシュ取得エラー:', error);
    return null;
  }
};

// 月次統計キャッシュの保存
const saveMonthlyCache = async (cache: MonthlyAttendanceCache): Promise<void> => {
  try {
    const cacheId = `attendance_stats_${cache.year}_${String(cache.month + 1).padStart(2, '0')}`;
    const cacheRef = doc(db, 'monthly_attendance_cache', cacheId);
    
    await setDoc(cacheRef, {
      ...cache,
      lastCalculated: serverTimestamp(),
    });
    
    console.log('月次統計キャッシュを保存しました:', cacheId);
  } catch (error) {
    console.error('キャッシュ保存エラー:', error);
  }
};

// キャッシュ機能付き月次統計計算（新しいデータ構造に対応）
export const calculateMonthlyAttendanceStatsWithCacheV2 = async (
  year: number,
  month: number // 0-11 (JavaScriptの月表記)
): Promise<Record<string, { totalCount: number; teamStats: any[] }>> => {
  try {
    console.log(`📊 ${year}年${month + 1}月の月次統計をキャッシュ機能付きで取得中（新構造対応）...`);
    
    const yearStr = year.toString();
    const monthStr = (month + 1).toString().padStart(2, '0');
    
    // 新しいデータ構造からデータを取得
    let allLogs: AttendanceLog[] = [];
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
        const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');
        const daySnapshot = await getDocs(dayLogsRef);
        
        const dayLogs = daySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AttendanceLog));
        
        allLogs.push(...dayLogs);
      }
      
      console.log(`📁 新しいデータ構造から ${allLogs.length} 件のログを取得`);
    } catch (error) {
      console.log('新しいデータ構造の取得に失敗、従来版にフォールバック:', error);
      return await calculateMonthlyAttendanceStatsWithCache(year, month);
    }
    
    // データが見つからない場合は従来版にフォールバック
    if (allLogs.length === 0) {
      console.log('新しいデータ構造にデータなし、従来版を使用');
      return await calculateMonthlyAttendanceStatsWithCache(year, month);
    }
    
    // 現在のデータハッシュを生成
    const allUsers = await getAllUsers();
    const currentDataHash = generateDataHash(allLogs, allUsers);
    
    // キャッシュを確認
    const existingCache = await getMonthlyCache(year, month);
    
    // キャッシュが有効かチェック
    const isCacheValid = existingCache && 
      existingCache.dataHash === currentDataHash &&
      existingCache.lastLogCount === allLogs.length;
    
    if (isCacheValid) {
      console.log('✅ キャッシュからデータを取得しました');
      
      const result: Record<string, { totalCount: number; teamStats: any[] }> = {};
      Object.entries(existingCache.dailyStats).forEach(([dateKey, stats]) => {
        result[dateKey] = {
          totalCount: stats.totalCount,
          teamStats: stats.teamStats
        };
      });
      
      return result;
    }
    
    console.log('🔄 新しいデータ構造から月次統計を計算中...');
    
    // 月次統計を計算
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const result: Record<string, { totalCount: number; teamStats: any[] }> = {};
    
    // 各日の統計を計算
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toDateString();
      
      try {
        const teamStats = await getDailyAttendanceStatsV2(date);
        const totalCount = teamStats.reduce((sum, team) => 
          sum + team.gradeStats.reduce((teamSum, grade) => teamSum + grade.count, 0), 0
        );
        
        result[dateKey] = {
          totalCount,
          teamStats
        };
      } catch (error) {
        console.warn(`日別統計計算失敗: ${dateKey}`, error);
        result[dateKey] = {
          totalCount: 0,
          teamStats: []
        };
      }
    }
    
    // キャッシュに保存
    const cacheData: MonthlyAttendanceCache = {
      year,
      month,
      dailyStats: {},
      lastCalculated: serverTimestamp() as Timestamp,
      lastLogCount: allLogs.length,
      dataHash: currentDataHash
    };
    
    // 結果をキャッシュ形式に変換
    Object.entries(result).forEach(([dateKey, stats]) => {
      // DateStringをYYYY-MM-DD形式に変換
      const date = new Date(dateKey);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      cacheData.dailyStats[dateKey] = {
        date: dateStr,
        totalCount: stats.totalCount,
        teamStats: stats.teamStats.map((team: any) => ({
          teamId: team.teamId,
          teamName: team.teamName || '',
          gradeStats: team.gradeStats.map((grade: any) => ({
            grade: grade.grade,
            count: grade.count,
            userIds: grade.users.map((user: any) => user.uid)
          }))
        }))
      };
    });
    
    // 非同期でキャッシュを保存（エラーが発生しても結果は返す）
    saveMonthlyCache(cacheData).catch(error => 
      console.error('キャッシュ保存エラー:', error)
    );
    
    return result;
  } catch (error) {
    console.error('新しい月次統計計算エラー:', error);
    // エラー時は従来版にフォールバック
    return await calculateMonthlyAttendanceStatsWithCache(year, month);
  }
};

// キャッシュ機能付き月次統計計算（従来版）
export const calculateMonthlyAttendanceStatsWithCache = async (
  year: number,
  month: number // 0-11 (JavaScriptの月表記)
): Promise<Record<string, { totalCount: number; teamStats: any[] }>> => {
  try {
    console.log(`📊 ${year}年${month + 1}月の月次統計をキャッシュ機能付きで取得中...`);
    
    // 現在のデータ状況を確認
    const [allLogs, allUsers] = await Promise.all([
      getAllAttendanceLogs(),
      getAllUsers()
    ]);
    
    const currentDataHash = generateDataHash(allLogs, allUsers);
    console.log('現在のデータハッシュ:', currentDataHash);
    
    // キャッシュを確認
    const existingCache = await getMonthlyCache(year, month);
    
    // キャッシュが有効かチェック
    const isCacheValid = existingCache && 
      existingCache.dataHash === currentDataHash &&
      existingCache.lastLogCount === allLogs.length;
    
    if (isCacheValid) {
      console.log('✅ キャッシュからデータを取得しました');
      
      // キャッシュされたデータを適切な形式に変換
      const result: Record<string, { totalCount: number; teamStats: any[] }> = {};
      Object.entries(existingCache.dailyStats).forEach(([dateKey, stats]) => {
        result[dateKey] = {
          totalCount: stats.totalCount,
          teamStats: stats.teamStats
        };
      });
      
      return result;
    }
    
    console.log('🔄 キャッシュが無効または存在しないため、新規計算を実行します');
    
    // 新規計算を実行
    const freshStats = await calculateMonthlyAttendanceStats(year, month);
    
    // キャッシュ用にデータを変換
    const cacheData: MonthlyAttendanceCache = {
      year,
      month,
      dailyStats: {},
      lastCalculated: serverTimestamp() as Timestamp,
      lastLogCount: allLogs.length,
      dataHash: currentDataHash
    };
    
    // 結果をキャッシュ形式に変換
    Object.entries(freshStats).forEach(([dateKey, stats]) => {
      cacheData.dailyStats[dateKey] = {
        date: dateKey,
        totalCount: stats.totalCount,
        teamStats: stats.teamStats.map(team => ({
          teamId: team.teamId,
          teamName: team.teamName || `班${team.teamId}`,
          gradeStats: team.gradeStats.map((grade: any) => ({
            grade: grade.grade,
            count: grade.count,
            userIds: grade.users.map((user: any) => user.uid)
          }))
        }))
      };
    });
    
    // キャッシュを保存（非同期で実行）
    saveMonthlyCache(cacheData).catch(error => 
      console.error('キャッシュ保存に失敗しましたが、処理は続行します:', error)
    );
    
    return freshStats;
    
  } catch (error) {
    console.error('キャッシュ機能付き月次統計計算エラー:', error);
    // エラー時は通常の計算にフォールバック
    return await calculateMonthlyAttendanceStats(year, month);
  }
};

// 特定月のキャッシュを無効化
export const invalidateMonthlyCache = async (year: number, month: number): Promise<void> => {
  try {
    const cacheId = `attendance_stats_${year}_${String(month + 1).padStart(2, '0')}`;
    const cacheRef = doc(db, 'monthly_attendance_cache', cacheId);
    
    // キャッシュドキュメントを削除
    await setDoc(cacheRef, { deleted: true, deletedAt: serverTimestamp() });
    console.log('月次統計キャッシュを無効化しました:', cacheId);
  } catch (error) {
    console.error('キャッシュ無効化エラー:', error);
  }
};

// 全キャッシュを無効化（管理者用）
export const invalidateAllCache = async (): Promise<void> => {
  try {
    const cacheRef = collection(db, 'monthly_attendance_cache');
    const snapshot = await getDocs(cacheRef);
    
    const deletePromises = snapshot.docs.map(doc => 
      setDoc(doc.ref, { deleted: true, deletedAt: serverTimestamp() })
    );
    
    await Promise.all(deletePromises);
    console.log('全ての月次統計キャッシュを無効化しました');
  } catch (error) {
    console.error('全キャッシュ無効化エラー:', error);
  }
};

// 旧プロジェクト形式での出勤記録作成（テスト用）
export const createAttendanceLogLegacyFormat = async (
  uid: string,
  cardId: string,
  type: 'entry' | 'exit'
): Promise<boolean> => {
  try {
    // 旧プロジェクトと同じ形式でデータを保存
    await addDoc(collection(db, 'attendance_logs'), {
      uid,
      cardId,
      type,
      timestamp: new Date(), // 旧プロジェクトと同じ形式
    });
    
    console.log('旧形式での出勤記録を作成しました:', { uid, cardId, type });
    return true;
  } catch (error) {
    console.error('出勤記録作成エラー:', error);
    return false;
  }
};

// デバッグ用：出席ログの確認（改良版）
export const debugAttendanceLogs = async (): Promise<void> => {
  try {
    console.log('=== 出席ログデバッグ開始 ===');
    
    const logsRef = collection(db, 'attendance_logs');
    const snapshot = await getDocs(logsRef);
    
    console.log(`総ログ数: ${snapshot.docs.length}`);
    
    // 今日の日付を取得（日本時間）
    const currentDate = new Date();
    const jstNow = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
    const today = jstNow.toISOString().split('T')[0];
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    let todayCount = 0;
    let recentLogs: any[] = [];
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const timestamp = safeTimestampToDate(data.timestamp);
      
      if (timestamp) {
        // 今日のログをチェック
        if (timestamp >= todayStart && timestamp < todayEnd) {
          todayCount++;
          console.log(`今日のログ:`, {
            uid: data.uid,
            type: data.type,
            time: timestamp.toLocaleString('ja-JP')
          });
        }
        
        // 最近7日間のログを収集
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (timestamp >= sevenDaysAgo) {
          recentLogs.push({
            date: timestamp.toISOString().split('T')[0],
            time: timestamp.toLocaleString('ja-JP'),
            uid: data.uid,
            type: data.type
          });
        }
      }
    });
    
    console.log(`今日のログ数: ${todayCount}`);
    console.log(`過去7日間のログ数: ${recentLogs.length}`);
    
    if (recentLogs.length > 0) {
      console.log('最近のログサンプル（最新5件）:');
      recentLogs
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5)
        .forEach(log => console.log(log));
    }
    
    console.log('=== 出席ログデバッグ終了 ===');
  } catch (error) {
    console.error('デバッグエラー:', error);
  }
};

// テスト用：今日の出席ログを作成
export const createTodayTestAttendanceLogs = async (): Promise<void> => {
  try {
    console.log('=== 今日のテスト出席ログ作成開始 ===');
    
    // 数名のユーザーの今日の出勤ログを作成
    const allUsers = await getAllUsers();
    if (allUsers.length === 0) {
      console.log('ユーザーが見つかりません');
      return;
    }
    
    // 最初の5名のユーザーに今日の出勤ログを作成
    const testUsers = allUsers.slice(0, Math.min(5, allUsers.length));
    const today = new Date();
    
    for (const user of testUsers) {
      // 今日の9:00頃の出勤ログを作成
      const entryTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, Math.floor(Math.random() * 60));
      
      await addDoc(collection(db, 'attendance_logs'), {
        uid: user.uid,
        cardId: user.cardId || 'test-card',
        type: 'entry',
        timestamp: entryTime
      });
      
      console.log(`テスト出勤ログ作成: ${user.lastname} ${user.firstname} (${entryTime.toLocaleString('ja-JP')})`);
    }
    
    console.log('=== 今日のテスト出席ログ作成完了 ===');
  } catch (error) {
    console.error('テスト出席ログ作成エラー:', error);
  }
};

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


// 特定チームの勤怠ログを取得
export const getTeamAttendanceLogs = async (teamId: string, limitCount: number = 50): Promise<AttendanceLog[]> => {
  try {
    // チームに所属するユーザーを取得
    const members = await getTeamMembers(teamId);
    if (members.length === 0) return [];

    const memberUids = members.map(m => m.uid);

    // メンバーのUIDを使ってログを検索
    const logsRef = collection(db, 'attendance_logs');
    const q = query(
      logsRef,
      where('uid', 'in', memberUids),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
  } catch (error) {
    console.error('チームの勤怠ログ取得エラー:', error);
    return [];
  }
};

// ログIDを生成するヘルパー関数
export const generateAttendanceLogId = (uid: string): string => {
  return `${uid}_${Date.now()}`;
};

// ユーザーの出席記録を取得
export const getUserAttendanceRecords = async (uid: string, days: number = 30): Promise<any[]> => {
  try {
    // 過去N日分の日付範囲を計算
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // 出勤ログを取得
    const attendanceLogsRef = collection(db, 'attendance_logs');
    const q = query(
      attendanceLogsRef,
      where('uid', '==', uid),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 日付別に出席記録を整理
    const attendanceByDate: { [date: string]: { checkIn?: Date, checkOut?: Date } } = {};
    
    logs.forEach((log: any) => {
      const timestamp = safeTimestampToDate(log.timestamp);
      if (timestamp && timestamp >= startDate) {
        const dateStr = timestamp.toISOString().split('T')[0];
        
        if (!attendanceByDate[dateStr]) {
          attendanceByDate[dateStr] = {};
        }
        
        if (log.type === 'entry') {
          attendanceByDate[dateStr].checkIn = timestamp;
        } else if (log.type === 'exit') {
          attendanceByDate[dateStr].checkOut = timestamp;
        }
      }
    });

    // 出席記録配列に変換
    const attendanceRecords = Object.entries(attendanceByDate).map(([date, record]) => ({
      date,
      checkInTime: record.checkIn?.toISOString(),
      checkOutTime: record.checkOut?.toISOString()
    }));

    return attendanceRecords.sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    console.error('出席記録取得エラー:', error);
    // インデックスエラーの場合は空の配列を返す
    if (error instanceof Error && error.message.includes('index')) {
      console.warn('インデックス未作成のため、出席記録を取得できません。Firebaseコンソールでインデックスを作成してください。');
    }
    return [];
  }
};

// 今日の全体出席状況を取得（旧プロジェクト方式）
export const getTodayAttendanceStats = async (): Promise<any> => {
  try {
    // 今日の日付を取得（日本時間）
    const currentDate = new Date();
    const jstNow = new Date(currentDate.getTime() + (9 * 60 * 60 * 1000));
    const today = jstNow.toISOString().split('T')[0];
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    // 全ユーザーを取得
    const allUsers = await getAllUsers();
    console.log('getTodayAttendanceStats: 全ユーザー数:', allUsers.length);
    
    if (allUsers.length === 0) {
      return {
        date: today,
        totalUsers: 0,
        presentUsers: 0,
        statsByGrade: {}
      };
    }
    
    // 今日の出勤ログを取得
    const logsRef = collection(db, 'attendance_logs');
    const logsSnapshot = await getDocs(logsRef);
    console.log('getTodayAttendanceStats: 総ログ数:', logsSnapshot.docs.length);
    
    // 今日の出勤者を特定
    const todayAttendees = new Set<string>();
    let todayLogsCount = 0;
    
    logsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const timestamp = safeTimestampToDate(data.timestamp);
      
      if (timestamp && timestamp >= todayStart && timestamp < todayEnd) {
        todayLogsCount++;
        if (data.type === 'entry') {
          todayAttendees.add(data.uid);
          console.log('getTodayAttendanceStats: 今日の出勤:', data.uid, timestamp.toLocaleString('ja-JP'));
        }
      }
    });
    
    console.log('getTodayAttendanceStats: 今日のログ数:', todayLogsCount);
    console.log('getTodayAttendanceStats: 今日の出勤者数:', todayAttendees.size);
    
    // 学年別統計を作成
    const statsByGrade: { [grade: number]: { total: number, present: number, users: AppUser[] } } = {};
    
    allUsers.forEach(user => {
      const grade = user.grade;
      if (!statsByGrade[grade]) {
        statsByGrade[grade] = { total: 0, present: 0, users: [] };
      }
      
      statsByGrade[grade].total++;
      statsByGrade[grade].users.push(user);
      
      if (todayAttendees.has(user.uid)) {
        statsByGrade[grade].present++;
      }
    });
    
    return {
      date: today,
      totalUsers: allUsers.length,
      presentUsers: todayAttendees.size,
      statsByGrade
    };
  } catch (error) {
    console.error('今日の出席統計取得エラー:', error);
    return {
      date: new Date().toISOString().split('T')[0],
      totalUsers: 0,
      presentUsers: 0,
      statsByGrade: {}
    };
  }
};

// リンク要求を作成
export const createLinkRequest = async (token: string): Promise<string> => {
  const docRef = await addDoc(collection(db, 'link_requests'), {
    token,
    status: 'waiting',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

// トークンの状態を監視
export const watchTokenStatus = (
  token: string,
  callback: (status: string, data?: LinkRequest) => void
) => {
  const q = query(collection(db, 'link_requests'), where('token', '==', token), limit(1));
  
  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const docData = snapshot.docs[0].data() as LinkRequest;
      callback(docData.status, docData);
    }
  });
};
