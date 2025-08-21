
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { auth, getGitHubRedirectResult, signInWithGitHub } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { user, loading: authProviderLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  // Combined loading state to manage both auth provider and redirect processing
  const [isProcessingAuth, setIsProcessingAuth] = useState(true);

  useEffect(() => {
    // This effect handles the result of a redirect from GitHub
    getGitHubRedirectResult(auth).catch((error: any) => {
      console.error('Error handling redirect result', error);
      toast({
        title: "Login Failed",
        description: error.message || "An unexpected error occurred during sign-in.",
        variant: "destructive",
      });
    }).finally(() => {
      // After processing the redirect, we can rely on the AuthProvider's loading state.
      // We set our local processing state to false.
      setIsProcessingAuth(false);
    });
  }, [toast]);

  useEffect(() => {
    // This effect redirects the user to the dashboard if they are logged in.
    // It depends on the AuthProvider's state.
    if (!authProviderLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authProviderLoading, router]);

  const handleLogin = async () => {
    setIsProcessingAuth(true); // Show loader immediately on click
    try {
      // This will redirect the user to GitHub's login page
      await signInWithGitHub(auth);
    } catch (error: any) {
      console.error('Error signing in with GitHub', error);
      toast({
        title: "Login Failed",
        description: error.message || "An unexpected error occurred during sign-in.",
        variant: "destructive",
      })
      setIsProcessingAuth(false); // Hide loader on error
    }
  };
  
  // Show a loader while the auth provider is loading, or we are processing a redirect.
  if (authProviderLoading || isProcessingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // If we are done with all loading and there is still no user, show the login page.
  if (!user) {
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

  // Fallback loader in case the redirect in useEffect hasn't fired yet.
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
