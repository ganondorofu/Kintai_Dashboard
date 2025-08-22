
'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { convertPeriodToGrade, convertGradeToDisplay } from '@/lib/attendance-utils';
import type { DayStats } from '@/hooks/use-attendance-data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
      ) : dayStats && dayStats.length > 0 && dayStats.some(ts => ts.gradeStats.some(gs => gs.count > 0)) ? (
        <div className="space-y-6">
          {dayStats.map(teamStat => (
            teamStat.gradeStats.some(gs => gs.count > 0) && (
              <div key={teamStat.teamId} className="border rounded-lg p-4">
                <h4 className="font-semibold text-md mb-3">
                  {teamStat.teamName || `班: ${teamStat.teamId}`}
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamStat.gradeStats
                    .filter(gradeStat => gradeStat.count > 0)
                    .map(gradeStat => (
                    <div key={gradeStat.grade} className="bg-gray-50 rounded p-3">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1" className="border-b-0">
                                <AccordionTrigger className="flex justify-between items-center w-full py-1 hover:no-underline">
                                    <span className="font-medium">{convertGradeToDisplay(gradeStat.grade)}</span>
                                    <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                                        {gradeStat.count}人
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2">
                                    <div className="space-y-1 border-t pt-2 mt-1">
                                    {gradeStat.users.filter(u => u.isPresent).map(user => (
                                        <div key={user.uid} className="text-xs text-gray-600">
                                        {user.lastname || ''} {user.firstname || ''}
                                        </div>
                                    ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                  ))}
                </div>
              </div>
            )
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
