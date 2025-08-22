
"use client";

import { createContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, GithubAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  accessToken: string | null;
  setGitHubToken: (token: string) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
  accessToken: null,
  setGitHubToken: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // GitHubトークンを設定する関数
  const setGitHubToken = useCallback((token: string) => {
    console.log('[AuthProvider] Setting GitHub token:', token ? 'Token provided' : 'No token');
    if (token) {
      setAccessToken(token);
      sessionStorage.setItem('github_access_token', token);
      console.log('[AuthProvider] GitHub token saved and set');
    }
  }, []);

  useEffect(() => {
    // 参考プロジェクトのパターンに従った認証状態監視
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // セッションからGitHubトークンを復元
        const storedToken = sessionStorage.getItem('github_access_token');
        if (storedToken) {
          console.log('[AuthProvider] Restored GitHub token from session');
          setAccessToken(storedToken);
        } else {
          console.log('[AuthProvider] No stored GitHub token found');
        }
      } else {
        console.log('[AuthProvider] User signed out');
        setUser(null);
        setAppUser(null);
        setAccessToken(null);
        sessionStorage.removeItem('github_access_token');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Firestoreからユーザーデータを取得（参考プロジェクトと同じパターン）
    if (user) {
      console.log('[AuthProvider] User authenticated, fetching Firestore data');
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribe = onSnapshot(
        userDocRef,
        (doc) => {
          if (doc.exists()) {
            console.log('[AuthProvider] Firestore user data found');
            setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
          } else {
            console.log('[AuthProvider] No Firestore user data found');
            setAppUser(null);
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching user data:", error);
          setAppUser(null);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      console.log('[AuthProvider] No user, setting loading to false');
      setLoading(false);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, accessToken, setGitHubToken }}>
      {children}
    </AuthContext.Provider>
  );
};
