
'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface CalendarHeaderProps {
  currentDate: Date;
  monthlyLoading: boolean;
  cacheStatus: 'loading' | 'cached' | 'fresh';
  onNavigateMonth: (direction: 'prev' | 'next') => void;
  onRefresh?: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  monthlyLoading,
  cacheStatus,
  onNavigateMonth,
  onRefresh
}) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold">出席カレンダー</h2>
      <div className="flex items-center space-x-4">
        {monthlyLoading && cacheStatus === 'loading' && (
          <div className="text-sm text-gray-500 animate-pulse">データ取得中...</div>
        )}
        
        <button
          onClick={() => onNavigateMonth('prev')}
          className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          disabled={monthlyLoading}
        >
          ←
        </button>
        
        <div className="text-lg font-semibold min-w-[150px] text-center flex items-center justify-center">
          <span>{format(currentDate, 'yyyy年MM月', { locale: ja })}</span>
          {cacheStatus === 'cached' && !monthlyLoading && (
              <span className="ml-2 text-xs text-blue-500">(キャッシュ)</span>
          )}
        </div>
        
        <button
          onClick={() => onNavigateMonth('next')}
          className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          disabled={monthlyLoading}
        >
          →
        </button>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-600 disabled:opacity-50"
            title="データを再取得"
          >
            🔄
          </button>
        )}
      </div>
    </div>
  );
};
