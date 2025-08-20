'use client';

import { useEffect, useState } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AttendanceTrends from './attendance-trends';

function UserManagementTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>View and manage all club members.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>User table will be implemented in a future update. (e.g. /dashboard/users)</p>
      </CardContent>
    </Card>
  )
}

function DailyAttendanceTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Attendance</CardTitle>
        <CardDescription>See who is currently in the club room.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Daily attendance view will be implemented in a future update.</p>
      </CardContent>
    </Card>
  )
}


export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState<number | string>('--');

  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const usersCol = collection(db, "users");
        const snapshot = await getCountFromServer(usersCol);
        setTotalUsers(snapshot.data().count);
      } catch (error) {
        console.error("Error fetching user count: ", error);
        setTotalUsers('--');
      }
    };
    fetchUserCount();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6 space-y-6">
           <Card>
            <CardHeader>
                <CardTitle>Welcome, Admin!</CardTitle>
                <CardDescription>Here's a summary of club activity.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{totalUsers}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Active Today</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">--</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Avg. Activity Time</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">--h --m</p>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
           </Card>
           <DailyAttendanceTab />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManagementTab />
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <AttendanceTrends />
        </TabsContent>
      </Tabs>
    </div>
  );
}
