"use client";

import { createContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, GithubAuthProvider, getRedirectResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  accessToken: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
  accessToken: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log('[AuthProvider] Setting up auth state listener and checking redirect result');

    // Check for redirect result from GitHub OAuth
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('[AuthProvider] Redirect result found');
          // This gives you a GitHub Access Token. You can use it to access the GitHub API.
          const credential = GithubAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken;
          
          if (token) {
            console.log('[AuthProvider] GitHub access token obtained');
            setAccessToken(token);
            sessionStorage.setItem('github_access_token', token);
          }
          
          // The signed-in user info
          setUser(result.user);
        } else {
          console.log('[AuthProvider] No redirect result');
          // Try to restore token from sessionStorage
          const storedToken = sessionStorage.getItem('github_access_token');
          if (storedToken) {
            console.log('[AuthProvider] Restored access token from storage');
            setAccessToken(storedToken);
          }
        }
      })
      .catch((error) => {
        console.error('[AuthProvider] Redirect result error:', error);
        toast({
          title: 'Authentication Error',
          description: error.message || 'Failed to complete GitHub authentication',
          variant: 'destructive'
        });
      });

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('[AuthProvider] Auth state changed:', !!firebaseUser);
      setUser(firebaseUser);
      
      if (!firebaseUser) {
        setAppUser(null);
        setAccessToken(null);
        sessionStorage.removeItem('github_access_token');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    // Listen for Firestore user data when authenticated
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribe = onSnapshot(
        userDocRef,
        (doc) => {
          if (doc.exists()) {
            setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
          } else {
            setAppUser(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error("[AuthProvider] Error fetching user data:", error);
          setAppUser(null);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, accessToken }}>
      {children}
    </AuthContext.Provider>
  );
};
