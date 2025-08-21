
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GithubAuthProvider, User } from 'firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { auth, getGitHubRedirectResult, signInWithGitHub } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';
import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isProcessingAuth, setIsProcessingAuth] = useState(true);

  useEffect(() => {
    console.log('[RegisterPage] useEffect triggered. Auth loading:', authLoading);
    if (!authLoading) {
      console.log('[RegisterPage] Auth is not loading, processing redirect. App name:', auth.app.name);
      getGitHubRedirectResult(auth)
        .then(result => {
          console.log('[RegisterPage] getGitHubRedirectResult result:', result);
          if (result) {
            const credential = GithubAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
              console.log('[RegisterPage] Access Token found!');
              setAccessToken(credential.accessToken);
            } else {
              console.error('[RegisterPage] Credential or Access Token is missing.');
              setError('Could not get GitHub Access Token. Please try again.');
            }
          }
          // If result is null, it means the user either just landed on the page
          // or they are already logged in from a previous session.
          // The useAuth() hook will handle providing the user object in that case.
        })
        .catch(err => {
          console.error('[RegisterPage] Error from getGitHubRedirectResult:', err);
          setError(err.message || 'An error occurred during sign-in.');
        })
        .finally(() => {
          setIsProcessingAuth(false);
        });
    }
  }, [authLoading]);

  const handleLogin = async () => {
    setError(null);
    setIsProcessingAuth(true);
    try {
      await signInWithGitHub(auth);
    } catch (err: any) {
      console.error('[RegisterPage] Error signing in with GitHub', err);
      setError(err.message || 'An error occurred during sign-in.');
      setIsProcessingAuth(false);
    }
  };

  if (authLoading || isProcessingAuth) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying authentication...</p>
      </div>
    );
  }

  if (error) {
    return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle className="text-destructive">Authentication Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleLogin} size="lg" className="w-full">
                    <Github className="mr-2 h-5 w-5" />
                    Try Again
                </Button>
            </CardContent>
        </Card>
    )
  }

  if (user && accessToken) {
    return <RegisterForm token={token!} user={user} accessToken={accessToken} />;
  }
  
  if (user && !accessToken) {
    return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Verification Required</CardTitle>
              <CardDescription>We couldn't retrieve your GitHub organization details. Please re-authenticate to grant the necessary permissions.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleLogin} size="lg" className="w-full">
                    <Github className="mr-2 h-5 w-5" />
                    Re-authenticate with GitHub
                </Button>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Register Your Card</CardTitle>
        <CardDescription>To continue, please log in with your GitHub account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleLogin} size="lg" className="w-full" disabled={isProcessingAuth}>
          {isProcessingAuth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-5 w-5" />}
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
