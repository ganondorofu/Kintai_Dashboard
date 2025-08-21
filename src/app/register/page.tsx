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
import { useToast } from '@/hooks/use-toast';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, loading } = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await signInWithGitHub();
      const credential = GithubAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
      } else {
        toast({
            title: "Authentication Error",
            description: "Could not retrieve GitHub access token. Please try again.",
            variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error signing in with GitHub', error);
      toast({
        title: "Login Failed",
        description: error.message || 'An error occurred during sign-in.',
        variant: "destructive",
      });
    } finally {
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
          <Button onClick={handleLogin} size="lg" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Github className="mr-2 h-5 w-5" />}
            Login with GitHub
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (user && !accessToken) {
      // This state is hit when the user is logged in, but we don't have the access token yet.
      // This can happen on a page refresh. We need to re-auth to get the org scope token.
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
