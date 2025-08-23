
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
  firstname: z.string().min(1, '名を入力してください'),
  lastname: z.string().min(1, '姓を入力してください'),
  teamId: z.string().min(1, '班を選択してください'),
  grade: z.coerce.number().min(1, '期生を入力してください'),
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
        console.error("チーム情報の取得に失敗:", error);
        toast({
          title: "エラー",
          description: "チーム情報を読み込めませんでした。後でもう一度お試しください。",
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
        firstname: githubUser.name?.split(' ')[1] || '',
        lastname: githubUser.name?.split(' ')[0] || '',
      });
    }
  }, [githubUser, form]);


  const onSubmit = async (values: RegisterFormValues) => {
    if (!firebaseUser || !githubUser) {
      toast({ title: '認証エラー', description: 'ユーザーが認証されていません。', variant: 'destructive'});
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
      toast({ title: '登録が完了しました！', description: 'カードを使って勤怠を記録できます。' });

    } catch (e: any) {
       console.error('[RegisterForm] Registration error:', e);
       toast({ title: '登録に失敗しました', description: e?.message || '予期せぬエラーが発生しました。管理者に連絡してください。', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

   if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">登録完了！</CardTitle>
          <CardDescription>
            このウィンドウを閉じてください。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">プロフィールを完成させる</CardTitle>
        <CardDescription>
          GitHubアカウントは認証済みです。追加情報を入力してください。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="lastname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>姓</FormLabel>
                    <FormControl>
                        <Input placeholder="山田" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="firstname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>名</FormLabel>
                    <FormControl>
                        <Input placeholder="太郎" {...field} />
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
                  <FormLabel>班</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="所属している班を選択" />
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
                  <FormLabel>期生 (例: 10期生は「10」)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              登録を完了する
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
