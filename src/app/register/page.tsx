
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { auth, signInWithGitHub } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';
import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user: authUser, loading: authLoading, accessToken } = useAuth();

  const handleLogin = async () => {
    await signInWithGitHub(auth);
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
    return <RegisterForm token={token!} user={authUser} accessToken={accessToken} />;
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
            <RegistrationComponent />
        </Suspense>
    )
}
