'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onIdTokenChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';

interface AuthContextType {
  user: FirebaseUser | null;
  isLoading: boolean;
  sessionToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to manage session token in localStorage
const SESSION_TOKEN_KEY = 'eagle-pass-session-token';

const setSessionToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
};

const getSessionToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setToken] = useState<string | null>(getSessionToken());

  useEffect(() => {
    const auth = getFirebaseAuth();
    
    if (!auth) {
      console.warn('Firebase Auth not initialized');
      setIsLoading(false);
      return () => {};
    }

    // Use onIdTokenChanged to get the token when user logs in or token refreshes
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });

          if (response.ok) {
            const data = await response.json();
            setToken(data.sessionToken);
            setSessionToken(data.sessionToken);
          } else {
            // Failed to create session, log user out
            console.error('Failed to create session, logging out.');
            setToken(null);
            setSessionToken(null);
            auth.signOut();
          }
        } catch (error) {
          console.error('Error during session creation:', error);
          setToken(null);
          setSessionToken(null);
          auth.signOut();
        }
      } else {
        setUser(null);
        // Clear session token on logout
        if (sessionToken) {
          try {
            await fetch('/api/session', {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${sessionToken}` },
            });
          } catch (error) {
            console.error('Failed to invalidate session on the server:', error);
          }
        }
        setToken(null);
        setSessionToken(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Auth state change error:', error);
      setUser(null);
      setToken(null);
      setSessionToken(null);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []); // Remove sessionToken dependency to prevent re-runs

  const value = { user, isLoading, sessionToken };

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