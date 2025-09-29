

import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, collection, addDoc, query, where, onSnapshot, getDocs, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData, writeBatch, collectionGroup } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser, AttendanceLog, LinkRequest, Team, MonthlyAttendanceCache, CronSettings, ApiCallLog, Notification } from '@/types';
import type { GitHubUser } from './oauth';
import type { User as FirebaseUser } from 'firebase/auth';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { convertToJapaneseGrade } from '@/lib/utils';


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
    // Firestore's admin SDK might return a different Timestamp object
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
      return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
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

    const attendedUids = new Set<string>();
    // その日に一度でも'entry'ログがあれば出席とみなす
    logs.forEach(log => {
        if (log.type === 'entry') {
            attendedUids.add(log.uid);
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
  return convertToJapaneseGrade(kiseiNumber);
};

// 期生データのみを表示する関数
export const formatKisei = (kiseiNumber: number): string => {
  return `${kiseiNumber}期生`;
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

export const generateAttendanceLogId = (uid: string): string => {
  return `${uid}_${Date.now()}`;
};

export const getWorkdaysInRange = async (startDate: Date, endDate: Date): Promise<Date[]> => {
  try {
    const allLogs = await getAllAttendanceLogs(startDate, endDate, 10000); 
    const workdays = new Set<string>();
    allLogs.forEach(log => {
        const logDate = safeTimestampToDate(log.timestamp);
        if (logDate && log.type === 'entry') {
            workdays.add(logDate.toISOString().split('T')[0]);
        }
    });

    return Array.from(workdays).map(dateStr => new Date(dateStr));
  } catch (error) {
    console.error('Error fetching workdays from logs:', error);
    return [];
  }
};

export const handleAttendanceByCardId = async (cardId: string): Promise<{
  status: 'success' | 'error' | 'unregistered';
  message: string;
  subMessage?: string;
}> => {
  try {
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('cardId', '==', cardId), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      return { status: 'unregistered', message: '未登録のカードです' };
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = { uid: userDoc.id, ...userDoc.data() } as AppUser;
    
    const newLogType: 'entry' | 'exit' = (userData.status === 'exit' || !userData.status) ? 'entry' : 'exit';
    
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    const dateKey = `${year}-${month}-${day}`;
    const logId = generateAttendanceLogId(userData.uid);
    const newLogRef = doc(db, 'attendances', dateKey, 'logs', logId);

    const batch = writeBatch(db);
    
    batch.set(newLogRef, {
      uid: userData.uid,
      cardId: cardId,
      type: newLogType,
      timestamp: serverTimestamp(),
    });

    batch.update(userDoc.ref, {
      status: newLogType,
      lastStatusChangeAt: serverTimestamp(),
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

export const createManualAttendanceLog = async (user: AppUser): Promise<boolean> => {
  try {
    const newLogType: 'entry' | 'exit' = (user.status === 'exit' || !user.status) ? 'entry' : 'exit';
    const userRef = doc(db, 'users', user.uid);
    const now = new Date();
    const { year, month, day } = getAttendancePath(now);
    const dateKey = `${year}-${month}-${day}`;
    const logId = generateAttendanceLogId(user.uid);
    const newLogRef = doc(db, 'attendances', dateKey, 'logs', logId);

    const batch = writeBatch(db);

    batch.set(newLogRef, {
      uid: user.uid,
      type: newLogType,
      timestamp: serverTimestamp(),
      cardId: 'manual_admin',
    });

    batch.update(userRef, {
      status: newLogType,
      lastStatusChangeAt: serverTimestamp(),
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('手動勤怠記録エラー:', error);
    return false;
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

export const forceClockOutAllActiveUsers = async (): Promise<{ success: number; failed: number; noAction: number }> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('status', '==', 'entry'));
  const activeUsersSnapshot = await getDocs(q);

  let successCount = 0;
  let failedCount = 0;

  const activeUsers = activeUsersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));

  for (const user of activeUsers) {
    try {
      await createManualAttendanceLog(user);
      successCount++;
    } catch (error) {
      console.error(`ユーザー ${user.uid} の強制退勤処理中にエラー:`, error);
      failedCount++;
    }
  }

  return { 
    success: successCount, 
    failed: failedCount, 
    noAction: 0 // 全ユーザーを取得する必要がなくなったため、noActionは0
  };
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

export const createApiCallLog = async (endpoint: string, initialData: Partial<ApiCallLog>): Promise<string> => {
  const logRef = collection(db, 'api_call_logs');
  const docRef = await addDoc(logRef, {
    apiEndpoint: endpoint,
    timestamp: serverTimestamp(),
    ...initialData,
  });
  return docRef.id;
};

export const updateApiCallLog = async (logId: string, resultData: Partial<ApiCallLog>): Promise<void> => {
  const logRef = doc(db, 'api_call_logs', logId);
  await updateDoc(logRef, {
    ...resultData,
    completedAt: serverTimestamp(),
  });
};

export const getApiCallLogs = async (endpoint: string, count: number): Promise<ApiCallLog[]> => {
  const logsRef = collection(db, 'api_call_logs');
  const q = query(
    logsRef,
    where('apiEndpoint', '==', endpoint),
    orderBy('timestamp', 'desc'),
    limit(count)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApiCallLog));
};

// Notifications
export const getNotifications = async (count: number = 5): Promise<Notification[]> => {
  const notificationsRef = collection(db, 'notifications');
  const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(count));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
};

export const createNotification = async (data: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const notificationsRef = collection(db, 'notifications');
  const docRef = await addDoc(notificationsRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateNotification = async (id: string, data: Partial<Omit<Notification, 'id' | 'createdAt'>>): Promise<void> => {
  const notificationRef = doc(db, 'notifications', id);
  await updateDoc(notificationRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteNotification = async (id: string): Promise<void> => {
  const notificationRef = doc(db, 'notifications', id);
  await deleteDoc(notificationRef);
};
