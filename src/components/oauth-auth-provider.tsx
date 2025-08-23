"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, GithubAuthProvider, getRedirectResult, signInWithRedirect } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from "@/types";
import type { GitHubUser } from "@/lib/github";
import { doc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: FirebaseUser | null;
  githubUser: GitHubUser | null;
  appUser: AppUser | null;
  loading: boolean;
  accessToken: string | null;
  signInWithGitHub: () => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const signInWithGitHub = useCallback(() => {
    setLoading(true);
    const provider = new GithubAuthProvider();
    provider.addScope('read:org');
    signInWithRedirect(auth, provider).catch(error => {
      console.error("Sign in with redirect error", error);
      toast({ title: 'Login Error', description: error.message, variant: 'destructive' });
      setLoading(false);
    });
  }, [toast]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await auth.signOut();
      setUser(null);
      setAppUser(null);
      setGithubUser(null);
      setAccessToken(null);
      sessionStorage.clear();
      localStorage.clear();
    } catch (error: any) {
      console.error("Sign out error", error);
      toast({ title: 'Logout Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GithubAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            const token = credential.accessToken;
            setAccessToken(token);
            sessionStorage.setItem('github_access_token', token);
          }
          const ghUser = result.user.providerData.find(p => p.providerId === 'github.com');
          if (ghUser) {
             setGithubUser({
                id: parseInt(ghUser.uid, 10),
                login: ghUser.displayName || '',
                name: ghUser.displayName || '',
                email: ghUser.email || '',
                avatar_url: ghUser.photoURL || '',
             });
          }
        }
      })
      .catch((error) => {
        console.error("Get redirect result error:", error);
        toast({ title: "Authentication Error", description: error.message, variant: "destructive" });
      });

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setAppUser(null);
        setGithubUser(null);
        setAccessToken(null);
        setLoading(false);
      } else {
        const token = sessionStorage.getItem('github_access_token');
        if(token) {
          setAccessToken(token);
        }
      }
    });

    return () => unsubscribeAuth();
  }, [toast]);
  
  useEffect(() => {
    if (user?.uid) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
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
    <AuthContext.Provider value={{ user, githubUser, appUser, loading, accessToken, signInWithGitHub, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
