
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { auth, signInWithGitHub } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    setIsProcessingLogin(true);
    try {
      await signInWithGitHub(auth);
    } catch (error: any) {
      console.error('Error signing in with GitHub', error);
      toast({
        title: "Login Failed",
        description: error.message || "An unexpected error occurred during sign-in.",
        variant: "destructive",
      });
      setIsProcessingLogin(false);
    }
  };
  
  if (loading || isProcessingLogin || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
        <Button onClick={handleLogin} className="mt-8" size="lg" disabled={isProcessingLogin}>
          <Github className="mr-2 h-5 w-5" />
          Login with GitHub
        </Button>
      </div>
    </div>
  );
}
