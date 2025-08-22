
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getGitHubAuthUrl } from '@/lib/oauth';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // 既にログイン済みの場合はダッシュボードにリダイレクト
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleGitHubLogin = () => {
    setLoading(true);
    try {
      const authUrl = getGitHubAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('GitHubの認証に失敗しました:', error);
      setLoading(false);
    }
  };

  if (authLoading || user) {
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
                disabled={loading}
                className="w-full"
                size="lg"
            >
                {loading ? (
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
