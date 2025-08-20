'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing attendance trends.
 *
 * - analyzeAttendanceTrends - Analyzes attendance logs to predict peak activity times.
 * - AnalyzeAttendanceTrendsInput - The input type for the analyzeAttendanceTrends function.
 * - AnalyzeAttendanceTrendsOutput - The return type for the analyzeAttendanceTrends function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeAttendanceTrendsInputSchema = z.object({
  attendanceLogs: z.array(
    z.object({
      uid: z.string(),
      cardId: z.string(),
      type: z.enum(['entry', 'exit']),
      timestamp: z.string().describe('Timestamp in ISO format'),
    })
  ).describe('Array of attendance logs.'),
});
export type AnalyzeAttendanceTrendsInput = z.infer<typeof AnalyzeAttendanceTrendsInputSchema>;

const AnalyzeAttendanceTrendsOutputSchema = z.object({
  peakEntryTimes: z.array(
    z.object({
      time: z.string().describe('Time of day (e.g., 14:00)'),
      count: z.number().describe('Number of entries at this time'),
    })
  ).describe('Peak entry times'),
  peakExitTimes: z.array(
    z.object({
      time: z.string().describe('Time of day (e.g., 17:00)'),
      count: z.number().describe('Number of exits at this time'),
    })
  ).describe('Peak exit times'),
  summary: z.string().describe('A summary of attendance trends, including tool usage predictions and resource management recommendations.'),
});
export type AnalyzeAttendanceTrendsOutput = z.infer<typeof AnalyzeAttendanceTrendsOutputSchema>;

export async function analyzeAttendanceTrends(input: AnalyzeAttendanceTrendsInput): Promise<AnalyzeAttendanceTrendsOutput> {
  return analyzeAttendanceTrendsFlow(input);
}

const analyzeAttendanceTrendsPrompt = ai.definePrompt({
  name: 'analyzeAttendanceTrendsPrompt',
  input: {schema: AnalyzeAttendanceTrendsInputSchema},
  output: {schema: AnalyzeAttendanceTrendsOutputSchema},
  prompt: `You are an AI assistant that analyzes attendance logs to predict peak activity times for a club.

  Analyze the provided attendance logs and identify the peak entry and exit times.
  Provide a summary of the attendance trends, including the most common entry and exit times, and any patterns you observe.
  Based on this analysis, predict potential tool usage patterns and offer recommendations for resource management to optimize club operations.

  Attendance Logs:
  {{#each attendanceLogs}}
  - User: {{uid}}, Card ID: {{cardId}}, Type: {{type}}, Timestamp: {{timestamp}}
  {{/each}}

  Return the peak entry and exit times as arrays of time and count objects.
  Also return a summary of the attendance trends, tool usage predictions, and resource management recommendations.
  Make sure the response is valid JSON.
  `,
});

const analyzeAttendanceTrendsFlow = ai.defineFlow(
  {
    name: 'analyzeAttendanceTrendsFlow',
    inputSchema: AnalyzeAttendanceTrendsInputSchema,
    outputSchema: AnalyzeAttendanceTrendsOutputSchema,
  },
  async input => {
    const {output} = await analyzeAttendanceTrendsPrompt(input);
    return output!;
  }
);
