
"use client";

import { createContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, getGitHubRedirectResult, GithubAuthProvider } from "@/lib/firebase";
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
    // This effect handles the result of a sign-in redirect.
    // It should run once on the initial load of the app after a redirect.
    getGitHubRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('[AuthProvider] Caught redirect result.');
          const credential = GithubAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setAccessToken(credential.accessToken);
          }
          // The onAuthStateChanged listener below will handle setting the user.
        }
      })
      .catch((error) => {
        console.error('[AuthProvider] Error getting redirect result:', error);
      })
      .finally(() => {
        // After attempting to get the redirect result, set up the auth state listener.
        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
          console.log('[AuthProvider] onAuthStateChanged fired. User:', firebaseUser?.uid || null);
          setUser(firebaseUser);
          if (!firebaseUser) {
            // If there's no user, we're not loading anymore.
            setAppUser(null);
            setLoading(false);
          }
        });
        // return unsubscribeAuth; // This will be handled by the main useEffect return
      });
  }, []);

  useEffect(() => {
    // This effect listens for changes to the user's login state
    // and fetches their corresponding Firestore document.
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
        } else {
          // User is authenticated with Firebase, but not yet registered in our DB.
          setAppUser(null);
        }
        // Loading is finished once we have user and have checked for appUser.
        setLoading(false);
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
