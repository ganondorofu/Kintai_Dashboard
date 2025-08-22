
'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { convertPeriodToGrade, convertGradeToDisplay } from '@/lib/attendance-utils';
import type { DayStats } from '@/hooks/use-attendance-data';
import type { AppUser } from '@/types';

interface DayDetailProps {
  selectedDate: Date;
  dayStats: DayStats[];
  loading: boolean;
}

export const DayDetail: React.FC<DayDetailProps> = ({
  selectedDate,
  dayStats,
  loading
}) => {
  return (
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
                        <div className="text-xs text-gray-500 italic">
                          詳細データなし ({gradeStat.count}人)
                        </div>
                      ) : null}
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-gray-500 col-span-full">
                    この班の詳細データがありません
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          この日の出席記録はありません
        </div>
      )}
    </div>
  );
};
