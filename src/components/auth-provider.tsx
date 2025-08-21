
"use client";

import { createContext, useEffect, useState, ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/types";
import { doc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  accessToken: string | null; // This will now be handled within the page context where it's needed
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
  
  // The accessToken is now handled locally in the /register page
  // as it's only needed there during the registration process.
  const accessToken = null;

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      // If a user is not authenticated, we can immediately stop loading.
      if (!firebaseUser) {
        setAppUser(null);
        setLoading(false);
      }
      // If a user is authenticated, we will continue loading until we fetch their app-specific data.
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // This effect reacts to changes in the authenticated user.
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
        } else {
          // User is authenticated with Firebase, but doesn't have a profile in our DB yet.
          // This is expected during the registration flow.
          setAppUser(null);
        }
        // We are done loading once we have checked for the user's Firestore document.
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
