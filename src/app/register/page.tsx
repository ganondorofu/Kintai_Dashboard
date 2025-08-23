
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import RegisterForm from '@/components/register-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Github, LogOut, User } from 'lucide-react';
import { updateLinkRequestStatus } from '@/lib/data-adapter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const cardId = searchParams.get('cardId');
  const { user, githubUser, loading, signInWithGitHub, signOut } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRegistrationComplete, setIsRegistrationComplete] = useState(false);

  useEffect(() => {
    if (token) {
      updateLinkRequestStatus(token, 'opened');
    }
  }, [token]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGitHub();
    } catch(error) {
      console.error("Sign in failed", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
    await handleSignIn();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">認証情報を確認中...</p>
      </div>
    );
  }

  if (!token || !cardId) {
    return (
     <Card className="w-full max-w-md text-center">
       <CardHeader>
         <CardTitle>無効なリンク</CardTitle>
         <CardDescription>
          この登録リンクは無効です。キオスク端末でQRコードを再スキャンしてください。
         </CardDescription>
       </CardHeader>
     </Card>
   );
 }

 if (isRegistrationComplete) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">登録完了！</CardTitle>
          <CardDescription>
            このウィンドウを閉じてください。カードを使って勤怠を記録できます。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (user && githubUser) {
    return (
       <Card className="w-full max-w-md">
         <CardHeader>
           <CardTitle>プロフィールを完成させる</CardTitle>
           <CardDescription>
             以下のGitHubアカウントでログインしています。このアカウントで登録を続けますか？
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg border p-4">
                <Avatar>
                    <AvatarImage src={githubUser.avatar_url} alt={githubUser.login} />
                    <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{githubUser.name || githubUser.login}</p>
                    <p className="text-sm text-muted-foreground">{githubUser.email}</p>
                </div>
            </div>
            <RegisterForm 
              token={token} 
              cardId={cardId} 
              onRegistrationSuccess={() => setIsRegistrationComplete(true)}
            />
         </CardContent>
         <CardFooter className="flex-col gap-2">
            <Button variant="outline" className="w-full" onClick={handleSwitchAccount}>
                <LogOut className="mr-2 h-4 w-4" />
                別のアカウントでログイン
            </Button>
         </CardFooter>
       </Card>
    );
  }
  
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>カードを登録</CardTitle>
        <CardDescription>続けるには、GitHubアカウントでログインしてください。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleSignIn} size="lg" className="w-full" disabled={isSigningIn}>
          {isSigningIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-5 w-5" />}
          GitHubでログイン
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">登録ページを読み込み中...</p>
          </div>
        }>
            <RegisterContent />
        </Suspense>
    )
}
