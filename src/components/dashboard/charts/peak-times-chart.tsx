'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyzeAttendanceTrendsOutput } from '@/ai/flows/analyze-attendance-trends';

interface PeakTimesChartProps {
  peakEntryTimes: AnalyzeAttendanceTrendsOutput['peakEntryTimes'];
  peakExitTimes: AnalyzeAttendanceTrendsOutput['peakExitTimes'];
}

export default function PeakTimesChart({ peakEntryTimes, peakExitTimes }: PeakTimesChartProps) {
  
  const allTimes = new Set([...peakEntryTimes.map(t => t.time), ...peakExitTimes.map(t => t.time)]);
  const sortedTimes = Array.from(allTimes).sort();

  const chartData = sortedTimes.map(time => {
    const entry = peakEntryTimes.find(t => t.time === time);
    const exit = peakExitTimes.find(t => t.time === time);
    return {
      time,
      entries: entry ? entry.count : 0,
      exits: exit ? exit.count : 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Activity Times</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))',
                }}
              />
              <Legend />
              <Bar dataKey="entries" fill="hsl(var(--accent))" name="Entries" />
              <Bar dataKey="exits" fill="hsl(var(--destructive))" name="Exits" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
