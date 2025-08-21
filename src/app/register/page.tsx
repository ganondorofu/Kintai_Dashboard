
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { auth, signInWithGitHub, GithubAuthProvider, getRedirectResult } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';
import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [localUser, setLocalUser] = useState<User | null>(authUser);
  const [localAccessToken, setLocalAccessToken] = useState<string | null>(null);
  const [isProcessingAuth, setIsProcessingAuth] = useState(true);

  useEffect(() => {
    // This effect runs once on mount to handle the redirect result.
    const processRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const credential = GithubAuthProvider.credentialFromResult(result);
          setLocalUser(result.user);
          setLocalAccessToken(credential?.accessToken || null);
        }
      } catch (error: any) {
        console.error("[RegisterPage] Error getting redirect result:", error);
        toast({
          title: "Authentication Error",
          description: "Could not verify your GitHub session. Please try logging in again.",
          variant: "destructive",
        });
      } finally {
        setIsProcessingAuth(false);
      }
    };
    
    processRedirect();
  }, [toast]);
  
  useEffect(() => {
    // Sync localUser with authUser from provider
    if(authUser) {
      setLocalUser(authUser);
    }
  }, [authUser]);

  const handleLogin = async () => {
    setIsProcessingAuth(true);
    await signInWithGitHub(auth);
  };
  
  const isLoading = authLoading || isProcessingAuth;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying authentication...</p>
      </div>
    );
  }

  // If we have a user and an access token, show the registration form
  if (localUser && localAccessToken) {
    return <RegisterForm token={token!} user={localUser} accessToken={localAccessToken} />;
  }
  
  // If we have a user but no access token, it means they might need to re-auth
  // to grant the necessary org permissions.
  if (localUser && !localAccessToken) {
     return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Additional Permissions Required</CardTitle>
          <CardDescription>
            We couldn't retrieve your GitHub organization details. Please re-authenticate to grant the necessary permissions. This is a required step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} size="lg" className="w-full">
            <Github className="mr-2 h-5 w-5" />
            Re-authenticate with GitHub
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // If there's no user at all, show the initial login prompt.
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Register Your Card</CardTitle>
        <CardDescription>To continue, please log in with your GitHub account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleLogin} size="lg" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Github className="mr-2 h-5 w-5" />}
          Login with GitHub
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
            <p className="text-muted-foreground">Loading registration...</p>
          </div>
        }>
            <RegistrationComponent />
        </Suspense>
    )
}
