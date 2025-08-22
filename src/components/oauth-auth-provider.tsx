"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { getStoredAuthData, clearAuthData, validateToken, GitHubUser, OAuthTokens } from "@/lib/oauth";
import { useToast } from '@/hooks/use-toast';
import type { AppUser } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AuthContextType {
  user: GitHubUser | null;
  appUser: AppUser | null;
  loading: boolean;
  accessToken: string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
  accessToken: null,
  signOut: () => {},
});

export { AuthContext };

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { tokens, user: storedUser } = getStoredAuthData();
        
        if (tokens && storedUser) {
          // トークンの有効性を確認
          const isValid = await validateToken(tokens.access_token);
          
          if (isValid) {
            console.log('[AuthProvider] Valid token found, setting user');
            setUser(storedUser);
            setAccessToken(tokens.access_token);
          } else {
            console.log('[AuthProvider] Invalid token, clearing auth data');
            clearAuthData();
          }
        } else {
          console.log('[AuthProvider] No stored auth data found');
        }
      } catch (error) {
        console.error('[AuthProvider] Error initializing auth:', error);
        clearAuthData();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    // Firestoreからユーザーデータを取得（参考プロジェクトと同じパターン）
    if (user) {
      console.log('[AuthProvider] User authenticated, fetching Firestore data');
      const userDocRef = doc(db, "users", user.id.toString());
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
        },
        (error) => {
          console.error("Error fetching user data:", error);
          setAppUser(null);
        }
      );
      return () => unsubscribe();
    }
  }, [user]);

  const signOut = useCallback(() => {
    console.log('[AuthProvider] Signing out user');
    clearAuthData();
    setUser(null);
    setAppUser(null);
    setAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, accessToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
