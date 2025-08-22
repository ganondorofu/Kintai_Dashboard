'use client';

import { Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import RegisterForm from '@/components/register-form';
import { getGitHubAuthUrl } from '@/lib/oauth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Github } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function RegisterContent() {
  const { user: authUser, appUser, loading: authLoading, accessToken } = useAuth();
  const { toast } = useToast();

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

  if (authUser && accessToken) {
    console.log('[Register Page] Rendering RegisterForm with accessToken:', accessToken ? 'Available' : 'Not available');
    return <RegisterForm user={authUser} accessToken={accessToken} />;
  }
  
  if (authUser && !accessToken) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground">GitHub access token not found. Please re-authenticate.</p>
        <Button onClick={handleLogin} className="gap-2">
          <Github className="h-4 w-4" />
          Re-authenticate with GitHub
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Join Our Platform</CardTitle>
        <CardDescription>
          Sign in with your GitHub account to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleLogin} 
          className="w-full gap-2"
          size="lg"
        >
          <Github className="h-5 w-5" />
          Continue with GitHub
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          By continuing, you agree to our terms of service and privacy policy.
        </p>
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
    );
}
