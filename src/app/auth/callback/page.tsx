'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exchangeCodeForToken, getGitHubUser, getGitHubUserEmails, saveAuthData } from '@/lib/oauth';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`GitHub OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        setStatus('loading');

        // 認証コードをアクセストークンに交換
        const tokens = await exchangeCodeForToken(code, state || '');
        
        // ユーザー情報を取得
        const user = await getGitHubUser(tokens.access_token);
        
        // メールアドレスが空の場合は別途取得
        if (!user.email) {
          const emails = await getGitHubUserEmails(tokens.access_token);
          const primaryEmail = emails.find(email => email.primary && email.verified);
          if (primaryEmail) {
            user.email = primaryEmail.email;
          }
        }

        // 認証情報を保存
        saveAuthData(tokens, user);

        setStatus('success');
        
        // 登録ページにリダイレクト
        router.push('/register');
        
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Authentication failed');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authenticating with GitHub...</h2>
          <p className="text-muted-foreground">Please wait while we verify your credentials.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Authentication Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => router.push('/register')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
