'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import type { SessionData } from '@/lib/auth/sessionManager';
import { getUserByEmail } from '@/lib/firebase/firestore';
import { User } from '@/types';

interface SessionContextType {
  sessionData: SessionData | null;
  isLoading: boolean;
  error: string | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  sessionExpiresAt: Date | null;
  timeUntilExpiry: number | null; // milliseconds
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);

  // Session token storage
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Initialize session when user authenticates
  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!authUser) {
      // Clear session when user logs out
      clearSession();
      setIsLoading(false);
      return;
    }

    initializeSession();
  }, [authUser, authLoading]);

  // Session expiry countdown
  useEffect(() => {
    if (!sessionExpiresAt) {
      setTimeUntilExpiry(null);
      return;
    }

    const updateTimeUntilExpiry = () => {
      const now = Date.now();
      const expiry = sessionExpiresAt.getTime();
      const remaining = Math.max(0, expiry - now);
      
      setTimeUntilExpiry(remaining);

      // Auto-logout when session expires
      if (remaining === 0) {
        logout();
      }
    };

    // Update immediately
    updateTimeUntilExpiry();

    // Update every second
    const interval = setInterval(updateTimeUntilExpiry, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  // Auto-refresh session when approaching expiry
  useEffect(() => {
    if (!sessionToken || !timeUntilExpiry) return;

    // Refresh session when less than 5 minutes remaining
    const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    if (timeUntilExpiry < REFRESH_THRESHOLD && timeUntilExpiry > 0) {
      refreshSession();
    }
  }, [sessionToken, timeUntilExpiry]);

  // Fetch session info from API
  const fetchSession = async (): Promise<SessionData | null> => {
    try {
      const res = await fetch('/api/session', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.session as SessionData;
    } catch (err) {
      return null;
    }
  };

  const initializeSession = async () => {
    if (!authUser) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get user profile from Firestore
      const userProfile = await getUserByEmail(authUser.email || '');
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Fetch session from API
      const session = await fetchSession();
      if (session) {
        setSessionData(session);
        setSessionExpiresAt(new Date(session.expiresAt));
        setIsLoading(false);
        return;
      }
      // If no session, force logout
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session initialization failed');
      clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh session via API
  const refreshSession = async () => {
    try {
      const res = await fetch('/api/session/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        await logout();
        return;
      }
      const data = await res.json();
      if (data.session) {
        setSessionData(data.session);
        setSessionExpiresAt(new Date(data.session.expiresAt));
      }
    } catch (err) {
      await logout();
    }
  };

  // Logout via API
  const logout = async () => {
    try {
      await fetch('/api/session/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {}
    clearSession();
  };

  const clearSession = () => {
    setSessionData(null);
    setSessionToken(null);
    setSessionExpiresAt(null);
    setTimeUntilExpiry(null);
    setError(null);
    localStorage.removeItem('sessionToken');
  };

  const value: SessionContextType = {
    sessionData,
    isLoading: authLoading || isLoading,
    error,
    refreshSession,
    logout,
    sessionExpiresAt,
    timeUntilExpiry
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
} 