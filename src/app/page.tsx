'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Github } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { signInWithGitHub } from '@/lib/firebase';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    try {
      await signInWithGitHub();
      router.push('/dashboard');
    } catch (error) {
      console.error('Error signing in with GitHub', error);
      // Optionally, show a toast notification for the error
    }
  };

  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-primary font-headline">Club Attendance</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          NFC-based attendance system for your club.
        </p>
        <Button onClick={handleLogin} className="mt-8" size="lg">
          <Github className="mr-2 h-5 w-5" />
          Login with GitHub
        </Button>
      </div>
    </div>
  );
}
