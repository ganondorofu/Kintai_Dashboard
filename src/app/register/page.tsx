'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { User } from 'firebase/auth';
import { GithubAuthProvider } from 'firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { getGitHubRedirectResult, signInWithGitHub } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Github, Loader2, ShieldAlert } from 'lucide-react';
import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, loading } = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    // This effect handles the result of a redirect from GitHub
    getGitHubRedirectResult().then(result => {
        if (result) {
            // Successfully signed in.
            const credential = GithubAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                setAccessToken(credential.accessToken);
            } else {
                 toast({
                    title: "Authentication Error",
                    description: "Could not retrieve GitHub access token after redirect. Please try again.",
                    variant: "destructive",
                });
            }
        }
        // If result is null, it means the page loaded without a redirect,
        // which is fine. The user might already be logged in.
    }).catch((error: any) => {
        console.error('Error processing redirect:', error);
        toast({
            title: "Authentication Failed",
            description: error.message || "An error occurred during sign-in.",
            variant: "destructive",
        });
    }).finally(() => {
        // The onAuthStateChanged listener in AuthProvider will handle setting the user.
        // We just need to stop our loading indicators.
        setIsCheckingRedirect(false);
        setIsLoggingIn(false);
    });
  }, [toast]);


  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGitHub(); // This will trigger a redirect
    } catch (error: any) {
      console.error('Error signing in with GitHub', error);
      toast({
        title: "Login Failed",
        description: error.message || 'An error occurred during sign-in.',
        variant: "destructive",
      });
      setIsLoggingIn(false);
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

  // Show a loader while checking auth state from AuthProvider or from the redirect result
  if (loading || isCheckingRedirect) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying authentication...</p>
      </div>
    );
  }

  // If we're done loading and there's no user, show the login prompt.
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
          <Button onClick={handleLogin} size="lg" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Github className="mr-2 h-5 w-5" />}
            Login with GitHub
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // If user is logged in, but we don't have the access token (e.g. on a page refresh),
  // we need to re-authenticate to get it. The token is required for org checks.
  if (user && !accessToken) {
       return (
        <Card className="w-full max-w-md text-center">
            <CardHeader>
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
            <CardTitle className="text-2xl font-bold">Verification Required</CardTitle>
            <CardDescription>
                We need to verify your GitHub organization membership. Please re-authenticate to grant access.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <Button onClick={handleLogin} size="lg" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Github className="mr-2 h-5 w-5" />}
                Re-authenticate with GitHub
            </Button>
            </CardContent>
        </Card>
       )
  }

  // If we have the user and the access token, render the registration form.
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
