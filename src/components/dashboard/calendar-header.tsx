
'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CalendarHeaderProps {
  currentDate: Date;
  monthlyLoading: boolean;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
  onRefresh?: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  monthlyLoading,
  onNavigateMonth,
  onRefresh
}) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold">出席カレンダー</h2>
      <div className="flex items-center space-x-2">
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigateMonth('prev')}
          disabled={monthlyLoading}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-lg font-semibold min-w-[150px] text-center flex items-center justify-center">
          <span>{format(currentDate, 'yyyy年 M月', { locale: ja })}</span>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigateMonth('next')}
          disabled={monthlyLoading}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            className="h-8 w-8"
            title="データを再取得"
            disabled={monthlyLoading}
          >
            <RefreshCw className={`h-4 w-4 ${monthlyLoading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    </div>
  );
};
