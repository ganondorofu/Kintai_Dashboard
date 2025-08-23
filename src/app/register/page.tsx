
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import RegisterForm from '@/components/register-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Github } from 'lucide-react';
import { updateLinkRequestStatus } from '@/lib/data-adapter';


function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const cardId = searchParams.get('cardId');
  const { user, appUser, githubUser, loading, signInWithGitHub } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

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
  }

  // URLパラメータがない場合はエラー表示
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

  // 認証状態が確定するまでローディング表示を維持
  if (loading || isSigningIn) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">認証情報を確認中...</p>
      </div>
    );
  }

  // 認証済みの場合、登録フォームを表示
  if (user && githubUser) {
    return <RegisterForm token={token} cardId={cardId} />;
  }
  
  // 未認証の場合、ログインボタンを表示
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
