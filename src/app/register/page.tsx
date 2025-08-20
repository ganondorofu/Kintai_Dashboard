'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { User } from 'firebase/auth';
import { GithubAuthProvider } from 'firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { signInWithGitHub } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Github, Loader2, ShieldAlert } from 'lucide-react';
import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, loading } = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to retrieve access token from session storage on component mount
    const storedToken = sessionStorage.getItem('github_access_token');
    if (storedToken) {
      setAccessToken(storedToken);
    }
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const result = await signInWithGitHub();
      const credential = GithubAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        sessionStorage.setItem('github_access_token', credential.accessToken);
        setAccessToken(credential.accessToken);
      } else {
        setAuthError('Could not retrieve GitHub access token. Please try again.');
      }
    } catch (error: any) {
      console.error('Error signing in with GitHub', error);
      setAuthError(error.message || 'An error occurred during sign-in.');
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">Invalid Link</CardTitle>
          <CardDescription>
            This registration link is invalid. Please scan the QR code from the kiosk again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary font-headline">Register Your Card</CardTitle>
          <CardDescription className="text-lg">
            To continue, please log in with your GitHub account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} size="lg" className="w-full">
            <Github className="mr-2 h-5 w-5" />
            Login with GitHub
          </Button>
          {authError && <p className="mt-4 text-sm text-destructive">{authError}</p>}
        </CardContent>
      </Card>
    );
  }
  
  if (user && !accessToken) {
    return (
        <Card className="w-full max-w-md text-center">
        <CardHeader>
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="text-2xl font-bold">Verification Required</CardTitle>
          <CardDescription>
            We need to verify your GitHub organization membership. Please re-authenticate to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} size="lg" className="w-full">
            <Github className="mr-2 h-5 w-5" />
            Re-authenticate with GitHub
          </Button>
          {authError && <p className="mt-4 text-sm text-destructive">{authError}</p>}
        </CardContent>
      </Card>
    )
  }

  return <RegisterForm token={token} user={user} accessToken={accessToken!} />;
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
