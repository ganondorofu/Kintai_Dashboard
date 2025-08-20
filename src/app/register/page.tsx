'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { signInWithGitHub } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';
import RegisterForm from '@/components/register-form';

function RegistrationComponent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { user, loading } = useAuth();
  
  if (!token) {
    return <p className="text-destructive">Invalid registration link. Please try again from the kiosk.</p>;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary font-headline">Register Your Card</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          To continue, please log in with your GitHub account.
        </p>
        <Button onClick={signInWithGitHub} className="mt-8" size="lg">
          <Github className="mr-2 h-5 w-5" />
          Login with GitHub
        </Button>
      </div>
    );
  }

  return <RegisterForm token={token} user={user} />;
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RegistrationComponent />
        </Suspense>
    )
}
