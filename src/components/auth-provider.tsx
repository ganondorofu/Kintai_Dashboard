
"use client";

import { createContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, getRedirectResult, GithubAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
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
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // This effect should run only once on mount to handle auth state.
    const processAuth = async () => {
      try {
        // Check for redirect result first
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('[AuthProvider] Caught redirect result.');
          const credential = GithubAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken);
          }
          // The user object will be set by onAuthStateChanged shortly
        }
      } catch (error) {
        console.error('[AuthProvider] Error getting redirect result:', error);
      }

      // After processing potential redirect, set up the state listener.
      const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        console.log('[AuthProvider] onAuthStateChanged fired. User:', firebaseUser?.uid || null);
        setUser(firebaseUser);
        if (!firebaseUser) {
          // If no user, we are done loading.
          setAppUser(null);
          setLoading(false);
        }
      });
      
      // Do not return unsubscribeAuth immediately, it's handled in the cleanup
      return unsubscribeAuth;
    };

    const unsubscribePromise = processAuth();

    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, []);

  useEffect(() => {
    // This effect reacts to user changes to fetch Firestore data.
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
        } else {
          // User is authenticated, but not yet in our DB.
          setAppUser(null);
        }
        setLoading(false); // Done loading once we have user and checked for appUser.
      }, (error) => {
        console.error("[AuthProvider] Error fetching user data:", error);
        setAppUser(null);
        setLoading(false);
      });
      return () => unsubscribeUser();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, accessToken }}>
      {children}
    </AuthContext.Provider>
  );
};
