'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAllTeams } from '@/lib/data-adapter';
import type { Team } from '@/types';
import { useAuth } from '@/hooks/use-auth';

const formSchema = z.object({
  firstname: z.string().min(1, 'First name is required'),
  lastname: z.string().min(1, 'Last name is required'),
  teamId: z.string().min(1, 'Please select a team'),
  grade: z.coerce.number().min(1, 'Grade is required'),
});

type RegisterFormValues = z.infer<typeof formSchema>;

interface RegisterFormProps {
  token: string;
  cardId: string;
}

export default function RegisterForm({ token, cardId }: RegisterFormProps) {
  const { user: firebaseUser, githubUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const fetchedTeams = await getAllTeams();
        setTeams(fetchedTeams);
      } catch (error) {
        console.error("Failed to fetch teams:", error);
        toast({
          title: "Error",
          description: "Could not load teams. Please try again later.",
          variant: "destructive",
        });
      }
    };
    fetchTeams();
  }, [toast]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstname: '',
      lastname: '',
      teamId: '',
      grade: undefined,
    },
  });

  useEffect(() => {
    if (githubUser) {
      form.reset({
        firstname: githubUser.name?.split(' ')[0] || '',
        lastname: githubUser.name?.split(' ').slice(1).join(' ') || '',
      });
    }
  }, [githubUser, form]);


  const onSubmit = async (values: RegisterFormValues) => {
    if (!firebaseUser || !githubUser) {
      toast({ title: 'Authentication Error', description: 'User is not authenticated.', variant: 'destructive'});
      return;
    }

    setLoading(true);

    try {
      const uid = firebaseUser.uid;
      const userDocRef = doc(db, 'users', uid);
      const linkRequestRef = doc(db, 'link_requests', token);
      
      const userData = {
        uid: uid,
        github: githubUser.email || githubUser.login,
        githubLogin: githubUser.login,
        githubId: githubUser.id,
        name: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        cardId: cardId,
        firstname: values.firstname,
        lastname: values.lastname,
        teamId: values.teamId,
        grade: values.grade,
        role: 'user', // Default role
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userDocRef, userData);

      // Update link request
      const linkUpdateData = {
          status: 'done',
          uid: uid,
          github: githubUser.login,
          updatedAt: serverTimestamp()
      }
      await setDoc(doc(db, 'link_requests', token), linkUpdateData, { merge: true });


      setIsSuccess(true);
      toast({ title: 'Registration Successful!', description: 'You can now use your card to log attendance.' });

    } catch (e: any) {
       console.error('[RegisterForm] Registration error:', e);
       toast({ title: 'Registration Failed', description: e?.message || 'An unexpected error occurred. Please try again or contact an admin.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

   if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">Registration Complete!</CardTitle>
          <CardDescription>
            You can now close this window.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
        <CardDescription>
          Your GitHub account is authenticated. Please provide a few more details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="firstname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Taro" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="lastname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Yamada" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade (e.g., 10 for 10th generation)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Registration
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
