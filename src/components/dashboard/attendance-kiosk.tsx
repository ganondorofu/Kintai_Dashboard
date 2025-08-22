
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createAttendanceLogV2 } from '@/lib/data-adapter';
import type { AppUser } from '@/types';

interface AttendanceKioskProps {
  user: AppUser;
  onAttendanceRecord?: () => void;
}

export const AttendanceKiosk: React.FC<AttendanceKioskProps> = ({ user, onAttendanceRecord }) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [greeting, setGreeting] = useState<string>('');
  const [showGreeting, setShowGreeting] = useState<boolean>(false);
  const [buffer, setBuffer] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [manualMode, setManualMode] = useState<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 現在時刻を更新
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // クリーンアップ関数
  const cleanup = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  // 手動出勤/退勤処理
  const handleManualAttendance = useCallback(async (type: 'entry' | 'exit') => {
    if (isProcessing) return;

    setIsProcessing(true);
    cleanup();

    try {
      await createAttendanceLogV2(user.uid, type);
      
      const message = type === 'entry' 
        ? `${user.firstname}さん、いってらっしゃい` 
        : `${user.firstname}さん、お疲れ様でした`;
      
      setGreeting(message);
      setShowGreeting(true);
      timeoutRef.current = setTimeout(() => setShowGreeting(false), 3000);
      
      if (onAttendanceRecord) {
        onAttendanceRecord();
      }
    } catch (error) {
      console.error('出退勤処理エラー:', error);
      setGreeting('エラーが発生しました');
      setShowGreeting(true);
      timeoutRef.current = setTimeout(() => setShowGreeting(false), 3000);
    } finally {
      setIsProcessing(false);
    }
  }, [user, isProcessing, onAttendanceRecord]);

  // キーボード入力処理（NFCカード用）
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (manualMode || isProcessing) return;

      if (event.key === 'Enter') {
        if (buffer.trim()) {
          // TODO: カードIDでユーザー検索とログ記録
          console.log('カードID:', buffer.trim());
          setBuffer('');
        }
      } else if (event.key.length === 1) {
        setBuffer(prev => prev + event.key);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [buffer, manualMode, isProcessing]);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    return cleanup;
  }, []);

  return (
    <div className="space-y-6">
      {/* 時計表示 */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {currentTime}
            </div>
            <div className="text-lg text-gray-600">
              現在時刻
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 挨拶メッセージ */}
      {showGreeting && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center text-2xl font-semibold text-green-800">
              {greeting}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 手動出退勤ボタン */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            手動出退勤
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualMode(!manualMode)}
            >
              {manualMode ? 'NFC待機' : '手動モード'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {manualMode ? (
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleManualAttendance('entry')}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                出勤
              </Button>
              <Button
                onClick={() => handleManualAttendance('exit')}
                disabled={isProcessing}
                className="bg-red-600 hover:bg-red-700"
                size="lg"
              >
                退勤
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-lg text-gray-600">
                NFCカードをタッチしてください
              </div>
              {buffer && (
                <div className="text-sm text-gray-400">
                  入力中: {buffer}
                </div>
              )}
              <div className="text-xs text-gray-400">
                手動で操作する場合は「手動モード」をクリックしてください
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ユーザー情報 */}
      <Card>
        <CardHeader>
          <CardTitle>ユーザー情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div><strong>名前:</strong> {user.firstname} {user.lastname}</div>
            <div><strong>GitHubアカウント:</strong> {user.github}</div>
            <div><strong>班:</strong> {user.teamId || '未所属'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
