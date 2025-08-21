''''use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GithubAuthProvider, User } from 'firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { auth, getGitHubRedirectResult, setPersistence, browserLocalPersistence, signInWithGitHub } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';
import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    console.log('[RegisterPage] useEffect triggered.');
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
        // If result is null, we wait for onAuthStateChanged to give us the user.
      })
      .catch(err => {
        console.error('[RegisterPage] Error from getGitHubRedirectResult:', err);
        setError(err.message || 'An error occurred during sign-in.');
      });
  }, []);

  const handleLogin = async () => {
    setError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithGitHub();
    } catch (err: any) {
      console.error('[RegisterPage] Error signing in with GitHub', err);
      setError(err.message || 'An error occurred during sign-in.');
    }
  };

  if (loading) {
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

  // If we have a user from AuthProvider and an access token from the redirect
  if (user && accessToken) {
    return <RegisterForm token={token!} user={user} accessToken={accessToken} />;
  }

  // If we have a user but no access token (e.g. page refresh after registration)
  // We need to re-auth to get it for org checks.
  if (user && !accessToken) {
    return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CardTitle>Verification Required</CardTitle>
              <CardDescription>Please re-authenticate to verify your organization membership.</CardDescription>
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

  // If we are done loading and there is no user, show the login button.
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Register Your Card</CardTitle>
        <CardDescription>To continue, please log in with your GitHub account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleLogin} size="lg" className="w-full">
          <Github className="mr-2 h-5 w-5" />
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
''''