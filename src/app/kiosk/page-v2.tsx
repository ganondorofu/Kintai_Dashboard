'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createAttendanceLogV2WithId } from '@/lib/data-adapter';
import { generateAttendanceLogId } from '@/lib/data-adapter';
import type { LinkRequest } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { CheckCircle, Nfc, QrCode, Wifi, WifiOff, XCircle, Loader2, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type KioskMode = 'waiting' | 'attendance_menu' | 'success' | 'error';
type AttendanceType = 'entry' | 'exit';

export default function KioskPageV2() {
  const [mode, setMode] = useState<KioskMode>('waiting');
  const [message, setMessage] = useState('NFCカードをタッチしてください');
  const [subMessage, setSubMessage] = useState('');
  const [cardId, setCardId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [inputBuffer, setInputBuffer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetToWaiting = useCallback(() => {
    setMode('waiting');
    setMessage('NFCカードをタッチしてください');
    setSubMessage('');
    setCardId(null);
    setUserInfo(null);
    setIsLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // オンライン状態の監視
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // キーボード入力の処理
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (mode !== 'waiting') return;

      if (event.key === 'Enter') {
        if (inputBuffer.length > 0) {
          handleCardDetected(inputBuffer);
          setInputBuffer('');
        }
      } else if (event.key.length === 1) {
        setInputBuffer(prev => prev + event.key);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [mode, inputBuffer]);

  // カード検出時の処理
  const handleCardDetected = async (detectedCardId: string) => {
    if (!isOnline) {
      setMode('error');
      setMessage('オフラインです');
      setSubMessage('インターネット接続を確認してください');
      setTimeout(resetToWaiting, 3000);
      return;
    }

    setCardId(detectedCardId);
    setMessage('カード読み取り中...');
    setIsLoading(true);

    try {
      // カードIDからユーザー情報を取得（実際の実装では適切なクエリを使用）
      // 今回はデモ用に仮のユーザー情報を設定
      const mockUser = {
        uid: 'user_' + detectedCardId,
        firstname: 'ユーザー',
        lastname: detectedCardId.slice(-4),
        grade: 3,
        teamId: 'A'
      };

      setUserInfo(mockUser);
      setMode('attendance_menu');
      setMessage(`${mockUser.firstname} ${mockUser.lastname}さん`);
      setSubMessage('出勤または退勤を選択してください');
      
      // 10秒後に自動リセット
      timeoutRef.current = setTimeout(resetToWaiting, 10000);

    } catch (error) {
      console.error('カード読み取りエラー:', error);
      setMode('error');
      setMessage('カード読み取りに失敗しました');
      setSubMessage('もう一度お試しください');
      setTimeout(resetToWaiting, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // 出勤/退勤記録
  const handleAttendance = async (type: AttendanceType) => {
    if (!cardId || !userInfo) return;

    setIsLoading(true);
    setMessage('記録中...');

    try {
      // 新しい階層構造で勤怠記録を作成
      const logId = generateAttendanceLogId(userInfo.uid);
      const success = await createAttendanceLogV2WithId(
        userInfo.uid,
        type,
        cardId,
        logId
      );

      if (success) {
        setMode('success');
        setMessage(`${type === 'entry' ? '出勤' : '退勤'}を記録しました`);
        setSubMessage(`${userInfo.firstname} ${userInfo.lastname}さん お疲れ様です！`);
        
        // 成功音を再生（オプション）
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(
            `${userInfo.firstname}さん、${type === 'entry' ? '出勤' : '退勤'}を記録しました`
          );
          utterance.lang = 'ja-JP';
          speechSynthesis.speak(utterance);
        }
      } else {
        throw new Error('記録に失敗しました');
      }
    } catch (error) {
      console.error('勤怠記録エラー:', error);
      setMode('error');
      setMessage('記録に失敗しました');
      setSubMessage('もう一度お試しください');
    } finally {
      setIsLoading(false);
      setTimeout(resetToWaiting, 3000);
    }
  };

  // 現在の時刻
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isOnline ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-sm text-gray-600">
                {isOnline ? 'オンライン' : 'オフライン'}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {currentTime.toLocaleTimeString('ja-JP')}
            </div>
          </div>
          
          <CardTitle className="text-2xl font-bold text-gray-900">
            STEM研究部勤怠管理システム
          </CardTitle>
          
          <div className="text-lg font-mono bg-gray-100 rounded p-3 mt-4">
            {currentTime.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })}
          </div>
        </CardHeader>

        <CardContent className="text-center space-y-6">
          {/* 状態に応じた表示 */}
          {mode === 'waiting' && (
            <div className="space-y-6">
              <div className="animate-pulse">
                <Nfc className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  {message}
                </h2>
                <p className="text-gray-600">
                  NFCカードをタッチするか、カードIDを入力してください
                </p>
              </div>
            </div>
          )}

          {mode === 'attendance_menu' && userInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  {message}
                </h2>
                <p className="text-gray-600">{subMessage}</p>
                <div className="mt-2 text-sm text-gray-500">
                  学年: {userInfo.grade}年 | 班: {userInfo.teamId}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleAttendance('entry')}
                  disabled={isLoading}
                  size="lg"
                  className="h-20 bg-green-600 hover:bg-green-700 flex flex-col gap-2"
                >
                  <LogIn className="w-8 h-8" />
                  出勤
                </Button>
                
                <Button
                  onClick={() => handleAttendance('exit')}
                  disabled={isLoading}
                  size="lg"
                  variant="destructive"
                  className="h-20 flex flex-col gap-2"
                >
                  <LogOut className="w-8 h-8" />
                  退勤
                </Button>
              </div>

              <Button
                onClick={resetToWaiting}
                variant="outline"
                className="w-full"
              >
                キャンセル
              </Button>
            </div>
          )}

          {mode === 'success' && (
            <div className="space-y-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto animate-bounce" />
              <div>
                <h2 className="text-xl font-semibold text-green-800 mb-2">
                  {message}
                </h2>
                <p className="text-green-600">{subMessage}</p>
              </div>
            </div>
          )}

          {mode === 'error' && (
            <div className="space-y-6">
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <div>
                <h2 className="text-xl font-semibold text-red-800 mb-2">
                  {message}
                </h2>
                <p className="text-red-600">{subMessage}</p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
