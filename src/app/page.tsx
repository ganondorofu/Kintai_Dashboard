
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { signInWithGitHub, appUser, user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  // Handle redirects after login
  useEffect(() => {
    if (!loading && user) {
        // appUser might still be loading, but we can redirect to dashboard
        // The dashboard will handle if appUser is null (needs registration)
        router.push('/dashboard');
    }
  }, [user, appUser, loading, router]);


  const handleGitHubLogin = async () => {
    setIsSigningIn(true);
    await signInWithGitHub();
    setIsSigningIn(false);
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            STEM研究部勤怠管理システム
          </CardTitle>
          <CardDescription>
            GitHubアカウントでログインしてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGitHubLogin}
            disabled={isSigningIn}
            className="w-full"
            size="lg"
          >
            {isSigningIn ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Github className="mr-2 h-5 w-5" />
            )}
            GitHubでログイン
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
