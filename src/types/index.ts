import type { Timestamp } from 'firebase/firestore';

export interface AppUser {
  uid: string;              // Firebase Auth UID または GitHub ID（文字列）
  github: string;
  githubLogin?: string;     // 新しいOAuth実装用
  githubId?: number;        // 新しいOAuth実装用（GitHub API の数値ID）
  firebaseUid?: string;     // 既存システムからの移行用（Firebase Auth UID）
  name?: string;            // 新しいOAuth実装用
  avatarUrl?: string;       // 新しいOAuth実装用
  cardId?: string;          // 既存データにはない場合があるためオプショナル
  firstname: string;
  lastname: string;
  teamId?: string;          // 既存データでteamIdがない場合があるためオプショナル
  grade: number;
  role?: 'user' | 'admin';  // 既存データにはroleがない場合があるためオプショナル
  oauthProvider?: 'github'; // OAuth認証プロバイダー情報
  lastLoginAt?: Timestamp;  // OAuth統合用に追加
  createdAt?: Timestamp;    // 既存データにはない場合があるためオプショナル
  updatedAt?: Timestamp;    // 既存データ構造に合わせて追加
}

export interface Team {
  id: string;
  name: string;
  leaderUid?: string;       // 既存データ構造に合わせて追加
  createdAt?: Timestamp;    // 既存データにはない場合があるためオプショナル
}

export interface AttendanceLog {
  id?: string;              // Firestoreドキュメントは自動生成されるためオプショナル
  uid: string;
  cardId?: string;          // 既存データではcardIdがない場合があるためオプショナル
  type: 'entry' | 'exit';
  timestamp: Timestamp;
}

export interface LinkRequest {
  id?: string;              // Firestoreドキュメントは自動生成されるためオプショナル
  token: string;
  cardId?: string;          // 既存データ構造では待機中はcardIdがない
  status: 'waiting' | 'linked' | 'done';
  uid?: string;             // リンク完了時のみ設定
  github?: string;          // 既存データ構造に合わせて追加
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 既存システムにある追加コレクション
export interface Workday {
  id?: string;              // ドキュメントIDは日付（YYYY-MM-DD）
  date: string;             // YYYY-MM-DD形式
  createdAt: Timestamp;
}

export interface Summary {
  id?: string;              // ドキュメントIDは workdays_{YYYY_MM} 形式
  totalDays: number;        // 月間の総労働日数
  updatedAt: Timestamp;
}

// 月次出席統計キャッシュ
export interface MonthlyAttendanceCache {
  id?: string;              // ドキュメントIDは attendance_stats_{YYYY_MM} 形式
  year: number;
  month: number;            // 0-11 (JavaScript形式)
  dailyStats: Record<string, {
    date: string;           // YYYY-MM-DD形式
    totalCount: number;
    teamStats: {
      teamId: string;
      teamName: string;
      gradeStats: {
        grade: number;
        count: number;
        userIds: string[];  // ユーザー詳細は別途取得
      }[];
    }[];
  }>;
  lastCalculated: Timestamp;
  lastLogCount: number;     // 計算時点での出勤ログ総数（変更検知用）
  dataHash: string;         // データ変更検知用ハッシュ
}
