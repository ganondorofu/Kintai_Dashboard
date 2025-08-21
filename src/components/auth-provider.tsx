
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
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('[AuthProvider] onAuthStateChanged fired. User:', firebaseUser?.uid || null);
      setUser(firebaseUser);
      if (!firebaseUser) {
        // If no user, not loading anymore
        setAppUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setAppUser({ uid: doc.id, ...doc.data() } as AppUser);
        } else {
          // User exists in auth, but not in firestore yet (e.g. during registration)
          // We can consider them "not fully logged in" yet from app perspective
          setAppUser(null);
        }
        setLoading(false); // Stop loading once we have user data or know it doesn't exist
      }, (error) => {
        console.error("Error fetching user data:", error);
        setAppUser(null);
        setLoading(false);
      });
      return () => unsubscribeUser();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
