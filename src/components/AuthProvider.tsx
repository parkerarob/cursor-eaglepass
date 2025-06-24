'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, FirebaseUser } from '@/lib/firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';

interface AuthContextType {
  user: FirebaseUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get auth instance at runtime
    const auth = getFirebaseAuth();
    
    // Check if auth is initialized
    if (!auth) {
      console.warn('Firebase Auth not initialized, user will remain null');
      setIsLoading(false);
      return () => {}; // Return no-op cleanup function
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    }, (error) => {
      console.error('Auth state change error:', error);
      setUser(null);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { user, isLoading };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 