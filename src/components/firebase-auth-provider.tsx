"use client";

import { createContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, GithubAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";
import type { GitHubUser } from "@/lib/github-types";

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  githubUser: GitHubUser | null;
  loading: boolean;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const signInWithGitHub = useCallback(async () => {
    const provider = new GithubAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle the user state update.
    } catch (error: any) {
      console.error("Sign in with popup error", error);
      toast({ title: 'Login Error', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    await auth.signOut();
    // Resetting state is handled by onAuthStateChanged
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setAppUser(null);
        setGithubUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const githubProviderData = user.providerData.find(p => p.providerId === 'github.com');
      if (githubProviderData) {
          const ghUser: GitHubUser = {
              id: parseInt(githubProviderData.uid, 10),
              login: githubProviderData.displayName || '',
              name: githubProviderData.displayName || '',
              email: githubProviderData.email || '',
              avatar_url: githubProviderData.photoURL || '',
          };
          setGithubUser(ghUser);
      }

      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setAppUser({ uid: docSnap.id, ...docSnap.data() } as AppUser);
        } else {
           setAppUser(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("Firestore user snapshot error:", error);
        setAppUser(null);
        setLoading(false);
      });

      return () => unsubscribeUser();
    } else {
      setLoading(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, appUser, githubUser, loading, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
