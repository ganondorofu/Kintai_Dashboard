
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import RegisterForm from '@/components/register-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Github } from 'lucide-react';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const cardId = searchParams.get('cardId');
  const { user, appUser, githubUser, loading, signInWithGitHub } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if(!loading && user && appUser) {
        // Already fully logged in and registered, but on register page?
        // Let's show a success message or redirect. For now, we assume
        // the user is here to link a new card if they are already registered.
        // The RegisterForm will handle this logic.
    }
  },[user, appUser, loading, router])

  const handleSignIn = async () => {
    setIsSigningIn(true);
    await signInWithGitHub();
    setIsSigningIn(false);
  }

  if (loading || isSigningIn) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">認証情報を確認中...</p>
      </div>
    );
  }

  // User is authenticated with Firebase, and has GitHub info, show registration form
  if (user && githubUser && token && cardId) {
    return <RegisterForm token={token} cardId={cardId} />;
  }
  
  // URL is missing parameters
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

  // Not authenticated, show login button
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>カードを登録</CardTitle>
        <CardDescription>続けるには、GitHubアカウントでログインしてください。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleSignIn} size="lg" className="w-full">
          <Github className="mr-2 h-5 w-5" />
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
