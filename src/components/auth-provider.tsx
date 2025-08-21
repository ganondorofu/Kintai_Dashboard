
"use client";

import { createContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, GithubAuthProvider } from "firebase/auth";
import { auth, db, getRedirectResult } from "@/lib/firebase";
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

  useEffect(() => {
    // This effect handles the redirect result from GitHub.
    // It should run only once when the app loads.
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GithubAuthProvider.credentialFromResult(result);
          if (credential) {
            setAccessToken(credential.accessToken || null);
          }
          setUser(result.user);
        }
      })
      .catch((error) => {
        console.error("[AuthProvider] Error getting redirect result:", error);
      })
      .finally(() => {
        // After attempting to get the redirect result, start listening for auth state changes.
        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            // If user is authenticated, we wait for Firestore data before setting loading to false.
          } else {
            setUser(null);
            setAppUser(null);
            setLoading(false); // No user, stop loading.
          }
        });
        return () => unsubscribeAuth();
      });
  }, []);

  useEffect(() => {
    // This effect reacts to changes in the authenticated user (from onAuthStateChanged).
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribeUser = onSnapshot(
        userDocRef,
        (doc) => {
          if (doc.exists()) {
            setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
          } else {
            // User is authenticated but doesn't have a profile in Firestore yet.
            // This is an expected state during the registration flow.
            setAppUser(null);
          }
          setLoading(false); // Finished loading user data from Firestore.
        },
        (error) => {
          console.error("[AuthProvider] Error fetching user data:", error);
          setAppUser(null);
          setLoading(false);
        }
      );
      return () => unsubscribeUser();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, appUser, loading, accessToken }}>
      {children}
    </AuthContext.Provider>
  );
};
