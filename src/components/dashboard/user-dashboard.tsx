'use client';

import type { AppUser, AttendanceLog } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";

interface UserDashboardProps {
  user: AppUser;
}

export default function UserDashboard({ user }: UserDashboardProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const logsQuery = query(
      collection(db, 'attendance_logs'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(logsQuery, (querySnapshot) => {
      const userLogs: AttendanceLog[] = [];
      querySnapshot.forEach((doc) => {
        userLogs.push({ id: doc.id, ...doc.data() } as AttendanceLog);
      });
      setLogs(userLogs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-headline">Welcome, {user.firstname}!</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">--</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Avg. Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">--h --m</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Attendance History</CardTitle>
          <CardDescription>Your last 20 attendance records.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{format(log.timestamp.toDate(), 'PPP')}</TableCell>
                    <TableCell>{format(log.timestamp.toDate(), 'p')}</TableCell>
                    <TableCell>
                      <Badge variant={log.type === 'entry' ? 'default' : 'secondary'} className={log.type === 'entry' ? 'bg-green-500' : 'bg-red-500'}>
                        {log.type}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center">No attendance records found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
