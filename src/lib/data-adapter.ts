
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, collection, addDoc, query, where, onSnapshot, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData, writeBatch, collectionGroup } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, AttendanceLog, LinkRequest, Team, MonthlyAttendanceCache, CronSettings } from '@/types';
import type { GitHubUser } from './oauth';
import type { User as FirebaseUser } from 'firebase/auth';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const JST_TIMEZONE = 'Asia/Tokyo';
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
export const safeTimestampToDate = (timestamp: any): Date | null => {
  try {
    if (!timestamp) return null;
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp && typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (timestamp && typeof timestamp === 'number') {
      const parsed = new Date(timestamp);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (timestamp && timestamp._seconds !== undefined && timestamp._nanoseconds !== undefined) {
      return new Timestamp(timestamp._seconds, timestamp._nanoseconds).toDate();
    }
    console.warn('無効なタイムスタンプ形式:', timestamp);
    return null;
  } catch (error) {
    console.error('タイムスタンプ変換エラー:', error, timestamp);
    return null;
  }
};

// 新しいデータ構造用のヘルパー関数
export const getAttendancePath = (date: Date): { year: string, month: string, day: string, fullPath: string } => {
  // JST (UTC+9) で日付を取得
  const jstDate = toZonedTime(date, JST_TIMEZONE);
  const year = formatInTimeZone(jstDate, JST_TIMEZONE, 'yyyy');
  const month = formatInTimeZone(jstDate, JST_TIMEZONE, 'MM');
  const day = formatInTimeZone(jstDate, JST_TIMEZONE, 'dd');
  
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
    const users = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    } as AppUser));

    // 今日の日付の最新ログを一度に取得
    const { year, month, day } = getAttendancePath(new Date());
    const dateKey = `${year}-${month}-${day}`;
    const todayLogsRef = collection(db, 'attendances', dateKey, 'logs');
    const todayLogsSnapshot = await getDocs(todayLogsRef);
    const todayLogs = todayLogsSnapshot.docs.map(doc => doc.data() as AttendanceLog);

    const latestLogs = new Map<string, AttendanceLog>();
    todayLogs.forEach(log => {
      const existing = latestLogs.get(log.uid);
      if (!existing || (safeTimestampToDate(log.timestamp)?.getTime() || 0) > (safeTimestampToDate(existing.timestamp)?.getTime() || 0)) {
        latestLogs.set(log.uid, log);
      }
    });

    return users.map(user => {
      const lastLog = latestLogs.get(user.uid);
      const status = lastLog?.type === 'entry' ? 'active' : 'inactive';
      return { ...user, status, last_activity: lastLog?.timestamp };
    });

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

const calculateDailyAttendanceFromLogsData = async (
  logs: AttendanceLog[],
  allUsers: AppUser[]
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: (AppUser & { isPresent: boolean })[] }[];
}[]> => {
  try {
    const teams = await getAllTeams();
    const teamMap = teams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {} as Record<string, string>);

    const latestLogs = new Map<string, AttendanceLog>();
    logs.forEach(log => {
      const existing = latestLogs.get(log.uid);
      if (!existing || (safeTimestampToDate(log.timestamp)?.getTime() || 0) > (safeTimestampToDate(existing.timestamp)?.getTime() || 0)) {
        latestLogs.set(log.uid, log);
      }
    });
    const attendedUids = new Set<string>();
    latestLogs.forEach((log, uid) => {
      if (log.type === 'entry') {
        attendedUids.add(uid);
      }
    });

    const teamGroups = allUsers.reduce((acc, user) => {
      const teamId = user.teamId || 'unassigned';
      if (!acc[teamId]) {
        acc[teamId] = [];
      }
      acc[teamId].push(user);
      return acc;
    }, {} as Record<string, AppUser[]>);

    return Object.entries(teamGroups).map(([teamId, users]) => {
      const gradeGroups = users.reduce((acc, user) => {
        const kiseiNumber = user.grade || 10;
        if (!acc[kiseiNumber]) {
          acc[kiseiNumber] = [];
        }
        acc[kiseiNumber].push(user);
        return acc;
      }, {} as Record<string, AppUser[]>);

      const gradeStats = Object.entries(gradeGroups).map(([gradeStr, gradeUsers]) => {
        const presentUsers = gradeUsers.filter(u => attendedUids.has(u.uid));
        return {
          grade: parseInt(gradeStr),
          count: presentUsers.length,
          users: gradeUsers.map(u => ({ ...u, isPresent: attendedUids.has(u.uid) }))
        };
      }).sort((a, b) => b.grade - a.grade);

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
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnapshot = await getDoc(userRef);
    
    if (userSnapshot.exists()) {
      const existingData = userSnapshot.data() as AppUser;
      const updatedUser: AppUser = {
        ...existingData,
        uid: firebaseUser.uid,
        lastLoginAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return updatedUser;
    } else {
      const providerData = firebaseUser.providerData.find(p => p.providerId === 'github.com');
      const githubUsername = providerData?.uid || firebaseUser.displayName || 'unknown';
      
      const newUser: AppUser = {
        uid: firebaseUser.uid,
        github: githubUsername,
        firstname: firebaseUser.displayName?.split(' ')[0] || githubUsername,
        lastname: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        grade: 10, // Default to 10th gen
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
    const logId = `${uid}_${Date.now()}`;
    return await createAttendanceLogV2WithId(uid, type, cardId, logId);
  } catch (error) {
    console.error('新しい出勤記録作成エラー:', error);
    return false;
  }
};

export const createAttendanceLogV2WithId = async (
  uid: string, 
  type: 'entry' | 'exit',
  cardId: string | undefined,
  logId: string
): Promise<boolean> => {
  try {
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    
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
    
    return true;
  } catch (error) {
    console.error('新しい出勤記録作成エラー:', error);
    return false;
  }
};

export const getUserAttendanceLogsV2 = async (
  uid: string,
  startDate?: Date,
  endDate?: Date,
  limitCount: number = 50
): Promise<AttendanceLog[]> => {
  try {
    const logs: AttendanceLog[] = [];
    const effectiveStartDate = startDate || new Date(0);
    const effectiveEndDate = endDate || new Date();

    const yearMonths = getYearMonthsInRange(effectiveStartDate, effectiveEndDate);

    for (const { year, month } of yearMonths) {
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            if (logs.length >= limitCount) break;

            const date = new Date(parseInt(year), parseInt(month) - 1, day);
            if (date < effectiveStartDate || date > effectiveEndDate) continue;

            const dateKey = `${year}-${month}-${day.toString().padStart(2, '0')}`;
            const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');

            const q = query(
              dayLogsRef,
              where('uid', '==', uid),
              orderBy('timestamp', 'desc')
            );
            
            const daySnapshot = await getDocs(q);
            const dayLogs = daySnapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() } as AttendanceLog)
            );
            logs.push(...dayLogs);
        }
    }
    
    return logs
      .sort((a, b) => {
        const timeA = safeTimestampToDate(a.timestamp)?.getTime() || 0;
        const timeB = safeTimestampToDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
      })
      .slice(0, limitCount);

  } catch (error) {
    console.error('新しい勤怠ログ取得エラー:', error);
    return [];
  }
};


export const getUserAttendanceLogs = async (
  uid: string, 
  startDate?: Date, 
  endDate?: Date,
  limitCount: number = 50
): Promise<AttendanceLog[]> => {
  try {
    const logsRef = collection(db, 'attendance_logs');
    
    let conditions: any[] = [
        where('uid', '==', uid),
        orderBy('timestamp', 'desc')
    ];

    if (startDate) {
        conditions.push(where('timestamp', '>=', startDate));
    }
    if (endDate) {
        conditions.push(where('timestamp', '<=', endDate));
    }

    if (limitCount > 0) {
      conditions.push(limit(limitCount));
    }

    let q = query(logsRef, ...conditions);
    
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

export const getAllAttendanceLogs = async (
  startDate?: Date,
  endDate?: Date,
  limitCount: number = 5000 
): Promise<AttendanceLog[]> => {
  try {
    let allLogs: AttendanceLog[] = [];

    const effectiveStartDate = startDate || new Date(0);
    const effectiveEndDate = endDate || new Date();
    
    const yearMonths = getYearMonthsInRange(effectiveStartDate, effectiveEndDate);

    for (const { year, month } of yearMonths) {
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            if (allLogs.length >= limitCount) break;
            
            const date = new Date(parseInt(year), parseInt(month) - 1, day);
            if (date < effectiveStartDate || date > effectiveEndDate) continue;
            
            const dateKey = `${year}-${month}-${day.toString().padStart(2, '0')}`;
            const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');
            const daySnapshot = await getDocs(dayLogsRef);
            
            const dayLogs = daySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AttendanceLog));
            allLogs.push(...dayLogs);
        }
        if (allLogs.length >= limitCount) break;
    }
    
    return allLogs
      .sort((a, b) => {
        const timeA = safeTimestampToDate(a.timestamp)?.getTime() || 0;
        const timeB = safeTimestampToDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
      })
      .slice(0, limitCount);
  } catch (error) {
    console.error('全勤怠ログ取得エラー:', error);
    return [];
  }
};

export const getDailyAttendanceStatsV2 = async (
  targetDate: Date
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: (AppUser & { isPresent: boolean })[] }[];
}[]> => {
  try {
    const allUsers = await getAllUsers();
    
    const { year, month, day } = getAttendancePath(targetDate);
    const dateKey = `${year}-${month}-${day}`;
    const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');
    const snapshot = await getDocs(dayLogsRef);

    const logs: AttendanceLog[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
    
    return await calculateDailyAttendanceFromLogsData(logs, allUsers);
  } catch (error) {
    console.error('新しい日別統計取得エラー:', error);
    return [];
  }
};

export const updateUser = async (uid: string, updates: Partial<AppUser>): Promise<boolean> => {
  try {
    // collectionGroupを使って、サブコレクション内にある可能性も考慮してユーザーを検索
    const usersRef = collectionGroup(db, 'users');
    const q = query(usersRef, where('uid', '==', uid), limit(1));
    const userSnapshot = await getDocs(q);

    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      await updateDoc(userDoc.ref, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    }

    // fallback: usersのトップレベルコレクションを検索
    const topLevelUserRef = doc(db, 'users', uid);
    const topLevelUserSnap = await getDoc(topLevelUserRef);
    if(topLevelUserSnap.exists()) {
      await updateDoc(topLevelUserRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    }
    
    console.error(`ユーザー(uid: ${uid})が見つかりません。`);
    return false;
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    return false;
  }
};

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

export const calculateMonthlyAttendanceStatsFromLogs = (logs: AttendanceLog[], year: number, month: number): Record<string, { date: string; attendeeCount: number; attendeeIds: string[] }> => {
  const stats: Record<string, { date: string; attendeeCount: number; attendeeIds: string[] }> = {};
  
  const monthLogs = logs.filter(log => {
    const logDate = safeTimestampToDate(log.timestamp);
    if (!logDate) return false;
    
    return logDate.getFullYear() === year && 
           logDate.getMonth() === month - 1;
  });
  
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
    
    if (!stats[dateKey].attendeeIds.includes(log.uid)) {
      stats[dateKey].attendeeIds.push(log.uid);
      stats[dateKey].attendeeCount++;
    }
  });
  
  return stats;
};

const generateDataHash = (logs: AttendanceLog[], users: AppUser[]): string => {
  const data = {
    logCount: logs.length,
    userCount: users.length,
    lastLogTimestamp: logs[0]?.timestamp?.toString() || '',
  };
  return btoa(JSON.stringify(data));
};

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

const saveMonthlyCache = async (cache: MonthlyAttendanceCache): Promise<void> => {
  try {
    const cacheId = `attendance_stats_${cache.year}_${String(cache.month + 1).padStart(2, '0')}`;
    const cacheRef = doc(db, 'monthly_attendance_cache', cacheId);
    
    await setDoc(cacheRef, {
      ...cache,
      lastCalculated: serverTimestamp(),
    });
    
  } catch (error) {
    console.error('キャッシュ保存エラー:', error);
  }
};

export const calculateMonthlyAttendanceStatsWithCacheV2 = async (
  year: number,
  month: number
): Promise<Record<string, { totalCount: number; teamStats: any[] }>> => {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); 
    const allLogs = await getAllAttendanceLogs(startDate, endDate);
    
    if (allLogs.length === 0) {
      return {};
    }
    
    const allUsers = await getAllUsers();
    const currentDataHash = generateDataHash(allLogs, allUsers);
    const existingCache = await getMonthlyCache(year, month);
    
    const isCacheValid = existingCache && 
      existingCache.dataHash === currentDataHash &&
      existingCache.lastLogCount === allLogs.length;
    
    if (isCacheValid) {
      const result: Record<string, { totalCount: number; teamStats: any[] }> = {};
      Object.entries(existingCache.dailyStats).forEach(([dateKey, stats]) => {
        result[dateKey] = {
          totalCount: stats.totalCount,
          teamStats: stats.teamStats
        };
      });
      return result;
    }
    
    const result: Record<string, { totalCount: number; teamStats: any[] }> = {};
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toDateString();
      const teamStats = await getDailyAttendanceStatsV2(date);
      const totalCount = teamStats.reduce((sum, team) => 
        sum + team.gradeStats.reduce((teamSum, grade) => teamSum + grade.count, 0), 0
      );
      result[dateKey] = { totalCount, teamStats };
    }
    
    const cacheData: MonthlyAttendanceCache = {
      year,
      month,
      dailyStats: {},
      lastCalculated: serverTimestamp() as Timestamp,
      lastLogCount: allLogs.length,
      dataHash: currentDataHash
    };
    
    Object.entries(result).forEach(([dateKey, stats]) => {
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
    
    saveMonthlyCache(cacheData).catch(error => 
      console.error('キャッシュ保存エラー:', error)
    );
    
    return result;
  } catch (error) {
    console.error('新しい月次統計計算エラー:', error);
    return {};
  }
};

export const invalidateMonthlyCache = async (year: number, month: number): Promise<void> => {
  try {
    const cacheId = `attendance_stats_${year}_${String(month + 1).padStart(2, '0')}`;
    const cacheRef = doc(db, 'monthly_attendance_cache', cacheId);
    
    await setDoc(cacheRef, { deleted: true, deletedAt: serverTimestamp() });
  } catch (error) {
    console.error('キャッシュ無効化エラー:', error);
  }
};

export const invalidateAllCache = async (): Promise<void> => {
  try {
    const cacheRef = collection(db, 'monthly_attendance_cache');
    const snapshot = await getDocs(cacheRef);
    
    const deletePromises = snapshot.docs.map(doc => 
      setDoc(doc.ref, { deleted: true, deletedAt: serverTimestamp() })
    );
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('全キャッシュ無効化エラー:', error);
  }
};

export const createAttendanceLogLegacyFormat = async (
  uid: string,
  cardId: string,
  type: 'entry' | 'exit'
): Promise<boolean> => {
  try {
    await addDoc(collection(db, 'attendance_logs'), {
      uid,
      cardId,
      type,
      timestamp: new Date(),
    });
    return true;
  } catch (error) {
    console.error('出勤記録作成エラー:', error);
    return false;
  }
};

export const debugAttendanceLogs = async (): Promise<void> => {
  try {
    const logsRef = collection(db, 'attendance_logs');
    const snapshot = await getDocs(logsRef);
    
    const currentDate = new Date();
    const jstNow = toZonedTime(currentDate, JST_TIMEZONE);
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
        if (timestamp >= todayStart && timestamp < todayEnd) {
          todayCount++;
        }
        
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
    
  } catch (error) {
    console.error('デバッグエラー:', error);
  }
};

export const createTodayTestAttendanceLogs = async (): Promise<void> => {
  try {
    const allUsers = await getAllUsers();
    if (allUsers.length === 0) {
      return;
    }
    
    const testUsers = allUsers.slice(0, Math.min(5, allUsers.length));
    const today = new Date();
    
    for (const user of testUsers) {
      const entryTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, Math.floor(Math.random() * 60));
      
      await addDoc(collection(db, 'attendance_logs'), {
        uid: user.uid,
        cardId: user.cardId || 'test-card',
        type: 'entry',
        timestamp: entryTime
      });
    }
    
  } catch (error) {
    console.error('テスト出席ログ作成エラー:', error);
  }
};

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

export const getTeamAttendanceLogs = async (teamId: string, limitCount: number = 50): Promise<AttendanceLog[]> => {
  try {
    const members = await getTeamMembers(teamId);
    if (members.length === 0) return [];

    const memberUids = members.map(m => m.uid);

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

export const generateAttendanceLogId = (uid: string): string => {
  return `${uid}_${Date.now()}`;
};

export const getWorkdaysInRange = async (startDate: Date, endDate: Date): Promise<Date[]> => {
    const workdaysRef = collection(db, 'workdays');
    const q = query(
        workdaysRef,
        where('date', '>=', startDate.toISOString().split('T')[0]),
        where('date', '<=', endDate.toISOString().split('T')[0])
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
        return snapshot.docs.map(doc => new Date(doc.data().date));
    }
    
    const allLogs = await getAllAttendanceLogs(startDate, endDate, 5000); 
    const workdays = new Set<string>();
    allLogs.forEach(log => {
        const logDate = safeTimestampToDate(log.timestamp);
        if (logDate && log.type === 'entry') {
            workdays.add(logDate.toISOString().split('T')[0]);
        }
    });

    return Array.from(workdays).map(dateStr => new Date(dateStr));
};

export const handleAttendanceByCardId = async (cardId: string): Promise<{
  status: 'success' | 'error' | 'unregistered';
  message: string;
  subMessage?: string;
}> => {
  try {
    // `users`コレクションを階層を問わず検索
    const usersRef = collectionGroup(db, 'users');
    const userQuery = query(usersRef, where('cardId', '==', cardId), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      return { status: 'unregistered', message: '未登録のカードです', subMessage: '登録するには「/」キーを押してください' };
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data() as AppUser;
    const userId = userDoc.id;

    // 最新のログを取得して次のアクションを決定
    const allLogs = await getUserAttendanceLogsV2(userId, undefined, undefined, 1);
    const legacyLogs = await getUserAttendanceLogs(userId, undefined, undefined, 1);
    
    const latestLog = [ ...allLogs, ...legacyLogs]
      .sort((a, b) => {
        const timeA = safeTimestampToDate(a.timestamp)?.getTime() || 0;
        const timeB = safeTimestampToDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
      })[0];
      
    const lastAction = latestLog ? latestLog.type : 'exit'; // ログがなければ出勤
    const newLogType: 'entry' | 'exit' = lastAction === 'entry' ? 'exit' : 'entry';
    const newStatus = newLogType === 'entry' ? 'active' : 'inactive';

    const batch = writeBatch(db);

    // 新しい勤怠ログを attendances に作成
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    const dateKey = `${year}-${month}-${day}`;
    const logId = generateAttendanceLogId(userId);
    const newLogRef = doc(db, 'attendances', dateKey, 'logs', logId);

    batch.set(newLogRef, {
      uid: userId,
      cardId: cardId,
      type: newLogType,
      timestamp: serverTimestamp(),
    });

    // userDoc.ref を使ってドキュメントの正確なパスを取得して更新
    batch.update(userDoc.ref, {
      status: newStatus,
      last_activity: serverTimestamp(),
    });

    await batch.commit();

    const userName = `${userData.lastname} ${userData.firstname}`;
    const actionMsg = newLogType === 'entry' ? '出勤を記録しました' : '退勤を記録しました';

    return { status: 'success', message: `ようこそ、${userName}さん`, subMessage: actionMsg };
  } catch (err) {
    console.error("勤怠記録エラー:", err);
    return { status: 'error', message: 'エラーが発生しました', subMessage: 'もう一度お試しください' };
  }
};


export const getTodayAttendanceStats = async (): Promise<{
  presentUsers: number;
  totalUsers: number;
  statsByGrade: Record<string, { present: number; total: number }>;
}> => {
  try {
    const allUsers = await getAllUsers();
    const totalUsers = allUsers.length;

    const activeUsers = allUsers.filter(u => u.status === 'active');
    const presentUsers = activeUsers.length;

    const statsByGrade = allUsers.reduce((acc, user) => {
      const grade = user.grade || 0;
      if (!acc[grade]) {
        acc[grade] = { present: 0, total: 0 };
      }
      acc[grade].total++;
      if (user.status === 'active') {
        acc[grade].present++;
      }
      return acc;
    }, {} as Record<string, { present: number; total: number }>);

    return { presentUsers, totalUsers, statsByGrade };
  } catch (error) {
    console.error('今日の出席統計取得エラー:', error);
    return { presentUsers: 0, totalUsers: 0, statsByGrade: {} };
  }
};

export const updateLinkRequestStatus = async (token: string, status: 'opened' | 'linked' | 'done'): Promise<boolean> => {
    try {
        const linkRequestRef = doc(db, 'link_requests', token);
        await setDoc(linkRequestRef, {
            status,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        return true;
    } catch (error) {
        console.error('Link request status update error:', error);
        return false;
    }
};

export const createLinkRequest = async (token: string): Promise<boolean> => {
    try {
        const linkRequestRef = doc(db, 'link_requests', token);
        await setDoc(linkRequestRef, {
            token,
            status: 'waiting',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return true;
    } catch (error) {
        console.error('Failed to create link request:', error);
        return false;
    }
};

export const watchTokenStatus = (token: string, callback: (status: string, data?: any) => void): (() => void) => {
    const linkRequestRef = doc(db, 'link_requests', token);
    return onSnapshot(linkRequestRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data() as LinkRequest;
            callback(data.status, data);
        }
    });
};

export const forceClockOutAllActiveUsers = async (): Promise<{ success: number, failed: number, noAction: number }> => {
  let success = 0;
  let failed = 0;
  let noAction = 0;

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('status', '==', 'active'));
    const activeUsersSnapshot = await getDocs(q);
    
    const allUsersSnapshot = await getDocs(collection(db, 'users'));
    noAction = allUsersSnapshot.size - activeUsersSnapshot.size;

    if (activeUsersSnapshot.empty) {
      return { success, failed, noAction };
    }
    
    const batch = writeBatch(db);
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    const dateKey = `${year}-${month}-${day}`;
    
    activeUsersSnapshot.docs.forEach(userDoc => {
      const user = { uid: userDoc.id, ...userDoc.data() } as AppUser;
      const logId = generateAttendanceLogId(user.uid);
      const newLogRef = doc(db, 'attendances', dateKey, 'logs', logId);
      
      batch.set(newLogRef, {
        uid: user.uid,
        type: 'exit',
        timestamp: serverTimestamp(),
        cardId: 'force_checkout'
      });
      
      batch.update(userDoc.ref, {
        status: 'inactive',
        last_activity: serverTimestamp()
      });
      success++;
    });

    await batch.commit();

  } catch (error) {
    console.error("強制退勤処理エラー:", error);
    failed = success > 0 ? success : (await getDocs(query(collection(db, 'users'), where('status', '==', 'active')))).size;
    success = 0;
  }
  
  return { success, failed, noAction };
};


export const getForceClockOutSettings = async (): Promise<CronSettings | null> => {
  try {
    const settingsRef = doc(db, 'settings', 'cron');
    const docSnap = await getDoc(settingsRef);
    if (docSnap.exists()) {
      return docSnap.data() as CronSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching cron settings:", error);
    return null;
  }
};

export const updateForceClockOutSettings = async (startTime: string, endTime: string): Promise<void> => {
  try {
    const settingsRef = doc(db, 'settings', 'cron');
    await setDoc(settingsRef, {
      forceClockOutStartTime: startTime,
      forceClockOutEndTime: endTime,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error updating cron settings:", error);
    throw error;
  }
};

// ------------------------------------------------
// -- DEPRECATED (but used by legacy components) --
// ------------------------------------------------

/** @deprecated */
const calculateDailyAttendanceFromLogs = async (
  targetDate: Date
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: (AppUser & { isPresent: boolean })[] }[];
}[]> => {
  try {
    const allUsers = await getAllUsers();
    
    const { year, month, day } = getAttendancePath(targetDate);
    const dateKey = `${year}-${month}-${day}`;
    const dayLogsRef = collection(db, 'attendances', dateKey, 'logs');
    const snapshot = await getDocs(dayLogsRef);
    
    if (snapshot.empty) {
        return [];
    }
    
    const logs: AttendanceLog[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
    
    return await calculateDailyAttendanceFromLogsData(logs, allUsers);

  } catch (error) {
    console.error('ログデータからの統計計算エラー:', error);
    return [];
  }
};

/** @deprecated */
export const getDailyAttendanceStats = async (
  targetDate: Date
): Promise<{
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: (AppUser & { isPresent: boolean })[] }[];
}[]> => {
  return calculateDailyAttendanceFromLogs(targetDate);
};


/** @deprecated */
export const calculateMonthlyAttendanceStats = async (
  year: number,
  month: number
): Promise<Record<string, { totalCount: number; teamStats: any[] }>> => {
  try {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0); 
    
    const allLogs = await getAllAttendanceLogs(monthStart, monthEnd);
    
    const allUsers = await getAllUsers();
    const allTeams = await getAllTeams();
    const teamMap = allTeams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {} as Record<string, string>);
    
    const dailyStats: Record<string, { totalCount: number; teamStats: any[] }> = {};
    
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const targetDate = new Date(year, month, day);
      const dateKey = targetDate.toDateString();
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const dayLogs = allLogs.filter(log => {
        const logDate = safeTimestampToDate(log.timestamp);
        if (!logDate) return false;
        
        return logDate >= startOfDay && logDate <= endOfDay;
      });
      
      const attendedUids = [...new Set(dayLogs.map(log => log.uid))];
      
      if (attendedUids.length === 0) {
        dailyStats[dateKey] = { totalCount: 0, teamStats: [] };
        continue;
      }
      
      const attendedUsers = allUsers.filter(user => attendedUids.includes(user.uid));
      
      const teamGroups = attendedUsers.reduce((acc, user) => {
        const teamId = user.teamId || 'unassigned';
        if (!acc[teamId]) {
          acc[teamId] = [];
        }
        acc[teamId].push(user);
        return acc;
      }, {} as Record<string, AppUser[]>);
      
      const teamStats = Object.entries(teamGroups).map(([teamId, teamUsers]) => {
        const gradeGroups = teamUsers.reduce((acc, user) => {
          const kiseiNumber = user.grade || 10;
          const actualGrade = convertKiseiiToGrade(kiseiNumber);
          
          if (!acc[actualGrade]) {
            acc[actualGrade] = [];
          }
          acc[actualGrade].push(user);
          return acc;
        }, {} as Record<number, AppUser[]>);

        const gradeStats = Object.entries(gradeGroups).map(([grade, gradeUsers]) => ({
          grade: parseInt(grade),
          kisei: gradeUsers[0]?.grade || 10,
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
    }
    
    return dailyStats;
  } catch (error) {
    console.error('月次出席統計計算エラー:', error);
    return {};
  }
};
    
