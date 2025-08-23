/**
 * 既存の出勤データを新しい階層構造に移行するスクリプト
 * 
 * 従来: /attendance_logs/{logId}
 * 新規: /attendances/{年月日}/logs/{logId}
 * 
 * 使用方法:
 * 1. Firebase Admin SDKの設定（後述）
 * 2. npm run migrate:attendance で実行
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { AttendanceLog } from '@/types';
import path from 'path';

// Firebase Admin SDK の初期化
if (!getApps().length) {
  try {
    const serviceAccountPath = path.join(process.cwd(), 'kintai-stem-honban.json');
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized with service account key file.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization failed.');
    console.error('Ensure "firebase-service-account-key.json" exists in the project root.');
    console.error('Original error:', error.message);
    process.exit(1);
  }
}

const db = getFirestore();

// 安全なタイムスタンプ変換
const safeTimestampToDate = (timestamp: any): Date | null => {
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

// パス生成ヘルパー
const getAttendancePath = (date: Date): { year: string, month: string, day: string } => {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return { year, month, day };
};

// 既存データ取得
const getExistingAttendanceLogs = async (): Promise<AttendanceLog[]> => {
  try {
    const snapshot = await db.collection('attendance_logs').get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
  } catch (error) {
    console.error('既存データ取得エラー:', error);
    return [];
  }
};

// 新しい構造への移行
const migrateToNewStructure = async (logs: AttendanceLog[]): Promise<{
  success: number;
  failed: number;
  skipped: number;
}> => {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  console.log(`📦 ${logs.length} 件のログを移行開始...`);

  for (const log of logs) {
    try {
      const logDate = safeTimestampToDate(log.timestamp);
      
      if (!logDate) {
        console.warn(`⚠️ 無効なタイムスタンプ: ${log.id}`);
        failed++;
        continue;
      }

      const { year, month, day } = getAttendancePath(logDate);
      
      // 旧構造と同じIDを新構造でも使用
      const originalLogId = log.id!;
      // 新しい構造: /attendances/{年月日}/logs/{logId}
      const dateKey = `${year}-${month}-${day}`;
      const newDocRef = db.collection('attendances').doc(dateKey).collection('logs').doc(originalLogId);
      
      // 既に存在するかチェック
      const existingDoc = await newDocRef.get();
      if (existingDoc.exists) {
        console.log(`⏭️ スキップ (既存): ${dateKey}/${originalLogId}`);
        skipped++;
        continue;
      }

      // 新しい構造に保存（元のIDを保持）
      await newDocRef.set({
        uid: log.uid,
        type: log.type,
        timestamp: log.timestamp, // 元のタイムスタンプを保持
        cardId: log.cardId || '',
        migratedAt: FieldValue.serverTimestamp(),
        originalId: originalLogId // 元のドキュメントIDを記録（念のため）
      });

      console.log(`✅ 移行成功: ${year}/${month}/${day}/${originalLogId}`);
      success++;
      
      // レート制限対策
      if (success % 50 === 0) {
        console.log(`📊 進捗: ${success}/${logs.length} (${Math.round(success / logs.length * 100)}%)`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`❌ 移行失敗: ${log.id}`, error);
      failed++;
    }
  }

  return { success, failed, skipped };
};

// データ検証
const verifyMigration = async (): Promise<boolean> => {
  try {
    console.log('🔍 移行データを検証中...');
    
    // 元データの件数
    const originalSnapshot = await db.collection('attendance_logs').get();
    const originalCount = originalSnapshot.size;
    
    // 新しい構造のデータ件数を概算で計算
    let newCount = 0;
    
    // 2024年と2025年の全日付をチェック
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear];
    
    for (const year of years) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const daysInMonth = new Date(year, month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
          const dayStr = day.toString().padStart(2, '0');
          const dateKey = `${year}-${monthStr}-${dayStr}`;
          
          try {
            const dayCollection = await db.collection('attendances').doc(dateKey).collection('logs').get();
            newCount += dayCollection.size;
          } catch (error) {
            // 存在しない日付はスキップ
          }
        }
      }
    }
    
    console.log(`📊 検証結果:`);
    console.log(`   元データ: ${originalCount} 件`);
    console.log(`   新データ: ${newCount} 件 (概算)`);
    
    const isValid = newCount > 0;
    console.log(`   結果: ${isValid ? '✅ データが移行されました' : '❌ データが見つかりません'}`);
    
    return isValid;
  } catch (error) {
    console.error('検証エラー:', error);
    return false;
  }
};

// メイン実行関数
export const runMigration = async (): Promise<void> => {
  console.log('🚀 出勤データ移行を開始します...');
  
  try {
    // 1. 既存データ取得
    const logs = await getExistingAttendanceLogs();
    console.log(`📄 ${logs.length} 件の既存データを発見`);
    
    if (logs.length === 0) {
      console.log('📭 移行対象のデータがありません');
      return;
    }
    
    // 2. 移行実行
    const result = await migrateToNewStructure(logs);
    
    console.log('📊 移行完了:');
    console.log(`   成功: ${result.success} 件`);
    console.log(`   失敗: ${result.failed} 件`);
    console.log(`   スキップ: ${result.skipped} 件`);
    
    // 3. 検証
    const isValid = await verifyMigration();
    
    if (isValid && result.failed === 0) {
      console.log('🎉 移行が正常に完了しました！');
    } else {
      console.log('⚠️ 移行に問題があります。ログを確認してください。');
    }
    
  } catch (error) {
    console.error('💥 移行中にエラーが発生:', error);
  }
};

// スクリプト直接実行時
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('スクリプト実行エラー:', error);
      process.exit(1);
    });
}
