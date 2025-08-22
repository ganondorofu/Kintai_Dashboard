'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getDailyAttendanceStats, getDailyAttendanceStatsV2, calculateMonthlyAttendanceStatsWithCache, calculateMonthlyAttendanceStatsWithCacheV2, formatKiseiAsGrade, invalidateMonthlyCache } from '@/lib/data-adapter';
import type { AppUser } from '@/types';

// 学年変換関数
const convertPeriodToGrade = (teamName: string) => {
  if (teamName?.includes('10期生')) return '1年生';
  if (teamName?.includes('9期生')) return '2年生';
  if (teamName?.includes('8期生')) return '3年生';
  return teamName || '未所属';
};

// 数値やperiod情報を表示用学年に変換
const convertGradeToDisplay = (grade: any) => {
  if (typeof grade === 'number') {
    // 数値の場合（10, 9, 8 など）
    if (grade === 10) return '1年生';
    if (grade === 9) return '2年生';
    if (grade === 8) return '3年生';
    return `${grade}期生`;
  }
  
  if (typeof grade === 'string') {
    // 文字列の場合
    if (grade.includes('10期生') || grade.includes('10')) return '1年生';
    if (grade.includes('9期生') || grade.includes('9')) return '2年生';
    if (grade.includes('8期生') || grade.includes('8')) return '3年生';
    return grade;
  }
  
  return '不明';
};

interface AttendanceCalendarProps {
  currentUser: AppUser;
}

interface DayStats {
  teamId: string;
  teamName?: string;
  gradeStats: { grade: number; count: number; users: AppUser[] }[];
}

interface MonthlyData {
  totalCount: number;
  teamStats: DayStats[];
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayStats, setDayStats] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<Record<string, MonthlyData>>({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'loading' | 'cached' | 'fresh'>('loading');
  
  // 月ごとのキャッシュ管理（複数月のデータを保持）
  const [monthlyCache, setMonthlyCache] = useState<Record<string, Record<string, MonthlyData>>>({});

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 現在の月のキー生成
  const getCurrentMonthKey = (date: Date = currentDate) => {
    return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
  };

  // 月次データを取得する関数（高速化版 - キャッシュ優先）
  const fetchMonthlyData = async (forceRefresh: boolean = false) => {
    const monthKey = getCurrentMonthKey();
    
    // キャッシュチェック（フォースリフレッシュでない場合）
    if (!forceRefresh && monthlyCache[monthKey]) {
      console.log('💾 キャッシュから即座に取得:', monthKey);
      setMonthlyData(monthlyCache[monthKey]);
      setCacheStatus('cached');
      setMonthlyLoading(false);
      return;
    }

    setMonthlyLoading(true);
    setCacheStatus('loading');
    try {
      console.log('� 月次データを取得中...', format(currentDate, 'yyyy年MM月'));
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth(); // 0-11形式
      
      // 強制リフレッシュの場合はキャッシュを無効化
      if (forceRefresh) {
        await invalidateMonthlyCache(year, month);
      }
      
      // 新しいデータ構造からの取得を試行（キャッシュ優先）
      try {
        const startTime = Date.now();
        const monthlyStats = await calculateMonthlyAttendanceStatsWithCacheV2(year, month);
        const endTime = Date.now();
        
        // MonthlyData形式に変換
        const convertedData: Record<string, MonthlyData> = {};
        Object.entries(monthlyStats).forEach(([dateKey, stats]) => {
          convertedData[dateKey] = {
            totalCount: stats.totalCount,
            teamStats: stats.teamStats
          };
        });
        
        // 現在の月のデータを設定
        setMonthlyData(convertedData);
        
        // キャッシュに保存
        setMonthlyCache(prev => ({
          ...prev,
          [monthKey]: convertedData
        }));
        
        setCacheStatus('cached');
        console.log(`✅ 新データ構造: ${Object.keys(convertedData).length}日分 (${endTime - startTime}ms)`);
      } catch (error) {
        console.log('⚠️ 新しいデータ構造で失敗、従来版を試行:', error);
        
        const startTime = Date.now();
        const monthlyStats = await calculateMonthlyAttendanceStatsWithCache(year, month);
        const endTime = Date.now();
        
        // MonthlyData形式に変換
        const convertedData: Record<string, MonthlyData> = {};
        Object.entries(monthlyStats).forEach(([dateKey, stats]) => {
          convertedData[dateKey] = {
            totalCount: stats.totalCount,
            teamStats: stats.teamStats
          };
        });
        
        // 現在の月のデータを設定
        setMonthlyData(convertedData);
        
        // キャッシュに保存
        setMonthlyCache(prev => ({
          ...prev,
          [monthKey]: convertedData
        }));
        
        setCacheStatus('cached');
        console.log(`✅ 従来版: ${Object.keys(convertedData).length}日分 (${endTime - startTime}ms)`);
      }
    } catch (error) {
      console.error('❌ 月次データ取得エラー:', error);
      setMonthlyData({});
      setCacheStatus('fresh');
    } finally {
      setMonthlyLoading(false);
    }
  };

  // 月が変わったら月次データを取得（キャッシュ優先）
  useEffect(() => {
    const monthKey = getCurrentMonthKey();
    
    // キャッシュチェック
    if (monthlyCache[monthKey]) {
      console.log('🏃‍♂️ 月切り替え - キャッシュから即座にロード:', monthKey);
      setMonthlyData(monthlyCache[monthKey]);
      setCacheStatus('cached');
      setMonthlyLoading(false);
    } else {
      console.log('📥 月切り替え - 新規取得が必要:', monthKey);
      fetchMonthlyData();
    }
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  const fetchDayStats = async (date: Date) => {
    setLoading(true);
    try {
      // 月次データから取得を試行
      const dateKey = date.toDateString();
      const monthlyDayData = monthlyData[dateKey];
      
      if (monthlyDayData && monthlyDayData.teamStats) {
        console.log('✅ 月次キャッシュから高速取得:', dateKey);
        setDayStats(monthlyDayData.teamStats);
        setLoading(false); // 即座にローディング終了
        return;
      }

      // キャッシュにない場合：バックグラウンドで単日計算
      console.log('⚡ バックグラウンドで単日計算:', dateKey);
      try {
        const stats = await getDailyAttendanceStatsV2(date);
        setDayStats(stats);
        
        // 取得したデータを月次キャッシュに追加
        setMonthlyData(prev => ({
          ...prev,
          [dateKey]: {
            totalCount: stats.reduce((total, team) => 
              total + (team.gradeStats ? team.gradeStats.reduce((teamTotal, grade) => teamTotal + (grade.count || 0), 0) : 0), 0
            ),
            teamStats: stats
          }
        }));
      } catch (error) {
        console.log('新しいデータ構造で失敗、従来版を試行:', error);
        const stats = await getDailyAttendanceStats(date);
        setDayStats(stats);
        
        // 従来版データもキャッシュに追加
        setMonthlyData(prev => ({
          ...prev,
          [dateKey]: {
            totalCount: stats.reduce((total, team) => 
              total + team.gradeStats.reduce((teamTotal, grade) => teamTotal + grade.count, 0), 0
            ),
            teamStats: stats
          }
        }));
      }
    } catch (error) {
      console.error('日別統計取得エラー:', error);
      setDayStats([]);
    } finally {
      setLoading(false);
    }
  };

  // ホバー時のプリロード機能（軽量化）
  const preloadDayStats = (date: Date) => {
    const dateKey = date.toDateString();
    const monthlyDayData = monthlyData[dateKey];
    
    // まだキャッシュにない場合のみ、軽量なプリロードを実行
    if (!monthlyDayData && !loading) {
      console.log('🔮 軽量プリロード:', dateKey);
      // 重い処理は避けて、キャッシュ確認のみ
    }
  };

  const handleDateClick = (date: Date) => {
    // 即座にUIを更新（楽観的UI）
    setSelectedDate(date);
    
    // キャッシュから即座に表示
    const dateKey = date.toDateString();
    const monthlyDayData = monthlyData[dateKey];
    
    if (monthlyDayData && monthlyDayData.teamStats) {
      // キャッシュデータがある場合は即座に表示
      setDayStats(monthlyDayData.teamStats);
      setLoading(false);
    } else {
      // キャッシュがない場合のみローディング表示
      setLoading(true);
      setDayStats([]); // 前のデータをクリア
    }
    
    // バックグラウンドでデータ取得
    fetchDayStats(date);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    
    // 選択状態をリセット
    setSelectedDate(null);
    setDayStats([]);
    
    // 新しい月のキャッシュをチェック
    const newMonthKey = getCurrentMonthKey(newDate);
    if (monthlyCache[newMonthKey]) {
      console.log('🚀 月移動 - キャッシュあり、ローディングなし:', newMonthKey);
      setMonthlyLoading(false);
    } else {
      console.log('⏳ 月移動 - 新規データ取得必要:', newMonthKey);
      setMonthlyLoading(true);
    }
    
    // 日付を更新（useEffectでキャッシュチェック実行）
    setCurrentDate(newDate);
  };

  const getTotalAttendance = (date: Date) => {
    const dateKey = date.toDateString();
    const monthlyDayData = monthlyData[dateKey];
    return monthlyDayData?.totalCount || 0;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">出席カレンダー</h2>
          <div className="flex items-center space-x-4">
            {monthlyLoading && (
              <div className="text-sm text-gray-500 animate-pulse">データ取得中...</div>
            )}
            
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 rounded-md bg-gray-100 hover:bg-gray-200"
              disabled={monthlyLoading}
            >
              ←
            </button>
            <h3 className="text-lg font-semibold">
              {format(currentDate, 'yyyy年MM月', { locale: ja })}
            </h3>
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 rounded-md bg-gray-100 hover:bg-gray-200"
              disabled={monthlyLoading}
            >
              →
            </button>
          </div>
        </div>

        {/* カレンダーグリッド */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['日', '月', '火', '水', '木', '金', '土'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-gray-600">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDayToday = isToday(day);
            const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
            
            return (
              <div
                key={day.toISOString()}
                onClick={() => !monthlyLoading && isCurrentMonth && handleDateClick(day)}
                onMouseEnter={() => !monthlyLoading && isCurrentMonth && preloadDayStats(day)}
                className={`
                  p-2 min-h-[60px] border transition-colors
                  ${!monthlyLoading && isCurrentMonth ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}
                  ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                  ${isDayToday ? 'bg-blue-100 border-blue-300' : 'border-gray-200'}
                  ${isSelected ? 'bg-blue-200 border-blue-400' : ''}
                  ${monthlyLoading ? 'opacity-50' : ''}
                `}
              >
                <div className="font-semibold text-sm">
                  {format(day, 'd')}
                </div>
                {isCurrentMonth && !monthlyLoading && getTotalAttendance(day) > 0 && (
                  <div className="text-xs text-blue-600 mt-1 font-medium">
                    {getTotalAttendance(day)}人
                  </div>
                )}
                {isCurrentMonth && monthlyLoading && (
                  <div className="text-xs text-gray-400 mt-1 animate-pulse">
                    読込中
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 選択日の詳細統計 */}
      {selectedDate && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {format(selectedDate, 'yyyy年MM月dd日', { locale: ja })} の出席状況
          </h3>

          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : dayStats && dayStats.length > 0 ? (
            <div className="space-y-6">
              {dayStats.map(teamStat => (
                <div key={teamStat.teamId} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-md mb-3">
                    {convertPeriodToGrade(teamStat.teamName || teamStat.teamId)}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teamStat.gradeStats && teamStat.gradeStats.length > 0 ? teamStat.gradeStats.map(gradeStat => (
                      <div key={gradeStat.grade} className="bg-gray-50 rounded p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{convertGradeToDisplay(gradeStat.grade)}</span>
                          <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                            {gradeStat.count}人
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          {gradeStat.users && gradeStat.users.length > 0 ? gradeStat.users.map(user => (
                            <div key={user.uid} className="text-xs text-gray-600">
                              {user.lastname || ''} {user.firstname || ''}
                              <span className="text-gray-400 ml-1">
                                ({convertGradeToDisplay(user.grade)})
                              </span>
                            </div>
                          )) : gradeStat.count > 0 ? (
                            <div className="text-xs text-gray-600">
                              {gradeStat.count}名出席
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">出席者なし</div>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-400">学年データなし</div>
                    )}
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-500">
                    合計: {teamStat.gradeStats ? teamStat.gradeStats.reduce((sum, grade) => sum + (grade.count || 0), 0) : 0}人
                  </div>
                </div>
              ))}
              
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-md mb-2">全体サマリー</h4>
                <div className="text-sm text-gray-700">
                  総出席者数: {dayStats && dayStats.length > 0 ? dayStats.reduce((total, team) => 
                    total + (team.gradeStats ? team.gradeStats.reduce((teamTotal, grade) => teamTotal + (grade.count || 0), 0) : 0), 0
                  ) : 0}人
                </div>
                <div className="text-sm text-gray-700">
                  参加班数: {dayStats ? dayStats.length : 0}班
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              この日の出席記録はありません
            </div>
          )}
        </div>
      )}
    </div>
  );
};
