'use client';

import { useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { AttendanceLog } from '@/types';
import { analyzeAttendanceTrends, type AnalyzeAttendanceTrendsOutput } from '@/ai/flows/analyze-attendance-trends';
import PeakTimesChart from './charts/peak-times-chart';

export default function AttendanceTrends() {
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeAttendanceTrendsOutput | null>(null);
  const { toast } = useToast();

  const handleAnalysis = async () => {
    setLoading(true);
    setAnalysisResult(null);

    try {
      // Fetch recent attendance logs
      const logsQuery = query(
        collection(db, 'attendance_logs'),
        orderBy('timestamp', 'desc'),
        limit(500) // Analyze up to 500 recent logs
      );
      const querySnapshot = await getDocs(logsQuery);
      const attendanceLogs = querySnapshot.docs.map(doc => {
        const data = doc.data() as AttendanceLog;
        return {
          ...data,
          timestamp: data.timestamp.toDate().toISOString(),
        };
      });

      if (attendanceLogs.length < 10) {
        toast({
          title: 'Not enough data',
          description: 'Need at least 10 attendance records to perform an analysis.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      
      const result = await analyzeAttendanceTrends({ attendanceLogs });
      setAnalysisResult(result);

    } catch (error) {
      console.error('Error analyzing attendance trends:', error);
      toast({
        title: 'Analysis Failed',
        description: 'An error occurred while analyzing the data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Trend Analysis</CardTitle>
        <CardDescription>
          Use AI to analyze attendance logs and predict peak activity times. This helps in managing club resources better.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={handleAnalysis} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? 'Analyzing...' : 'Analyze Attendance Trends'}
        </Button>

        {analysisResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{analysisResult.summary}</p>
              </CardContent>
            </Card>
            
            <PeakTimesChart 
              peakEntryTimes={analysisResult.peakEntryTimes} 
              peakExitTimes={analysisResult.peakExitTimes} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
