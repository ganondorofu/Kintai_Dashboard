
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
      if (appUser) {
        // User is logged in and has an app profile, go to dashboard
        router.push('/dashboard');
      } else {
        // User is logged in but has no app profile, go to register
        // This might happen on first login
        router.push('/register');
      }
    }
  }, [user, appUser, loading, router]);


  const handleGitHubLogin = () => {
    setIsSigningIn(true);
    signInWithGitHub();
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
            IT勤怠管理システム
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
