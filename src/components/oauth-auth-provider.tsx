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
      console.log("[AuthProvider] Initializing auth...");
      try {
        const { tokens, user: storedUser } = getStoredAuthData();
        
        if (tokens && storedUser) {
          console.log("[AuthProvider] Found stored auth data.");
          const isValid = await validateToken(tokens.access_token);
          
          if (isValid) {
            console.log('[AuthProvider] Valid token found, setting user');
            setUser(storedUser);
            setAccessToken(tokens.access_token);
          } else {
            console.log('[AuthProvider] Invalid token, clearing auth data');
            clearAuthData();
            setUser(null);
            setAccessToken(null);
          }
        } else {
          console.log('[AuthProvider] No stored auth data found');
          setUser(null);
          setAccessToken(null);
        }
      } catch (error) {
        console.error('[AuthProvider] Error initializing auth:', error);
        clearAuthData();
      } finally {
        // This will be handled by the next useEffect,
        // which depends on the user state.
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (user) {
      const uid = user.id.toString();
      console.log('[AuthProvider] User authenticated, fetching Firestore data for uid:', uid);
      const userDocRef = doc(db, "users", uid);
      unsubscribe = onSnapshot(
        userDocRef,
        (doc) => {
          if (doc.exists()) {
            console.log('[AuthProvider] Firestore user data found');
            setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
          } else {
            console.log('[AuthProvider] No Firestore user data found for uid:', uid);
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
    } else {
        console.log('[AuthProvider] No user, setting loading to false.');
        setLoading(false);
    }
    return () => unsubscribe();
  }, [user]);

  const signOut = useCallback(() => {
    console.log('[AuthProvider] Signing out user');
    clearAuthData();
    setUser(null);
    setAppUser(null);
    setAccessToken(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, accessToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
