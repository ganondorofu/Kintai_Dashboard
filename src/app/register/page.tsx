
'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import RegisterForm from '@/components/register-form';
import { getGitHubAuthUrl, updateLinkRequestStatus } from '@/lib/oauth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Github } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function RegisterContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user: authUser, appUser, loading: authLoading, accessToken } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (token) {
        updateLinkRequestStatus(token, 'opened');
    }
  }, [token]);

  const handleLogin = () => {
    try {
      const authUrl = getGitHubAuthUrl();
      console.log('[Register] Redirecting to GitHub OAuth:', authUrl);
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('[Register] OAuth URL generation error:', error);
      toast({
        title: 'Login Failed',
        description: error?.message || 'Unable to initiate GitHub sign-in.',
        variant: 'destructive'
      });
    }
  };
  
  if (authLoading) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Verifying authentication...</p>
      </div>
    );
  }

  if (authUser && accessToken && token) {
    console.log('[Register Page] Rendering RegisterForm with accessToken:', accessToken ? 'Available' : 'Not available');
    return <RegisterForm user={authUser} accessToken={accessToken} token={token} />;
  }
  
  if (authUser && accessToken && !token) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground">No registration token found in URL. Please use a valid registration link.</p>
        <Button onClick={() => window.history.back()} className="gap-2">
          Go Back
        </Button>
      </div>
    );
  }
  
  if (authUser && !accessToken) {
     return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Additional Permissions Required</CardTitle>
          <CardDescription>
            We couldn't retrieve your GitHub organization details. This can happen if you are returning to this page later. Please sign in again to continue.
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
            <RegisterContent />
        </Suspense>
    )
}
