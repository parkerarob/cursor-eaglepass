'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getUserByEmail, getUserById, createUser } from '@/lib/firebase/firestore';
import { User, UserRole } from '@/types';
import { extractNameFromEmail } from '@/lib/utils';

interface RoleContextType {
  currentRole: UserRole | null;
  currentUser: User | null;
  availableRoles: UserRole[];
  isDevMode: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  resetToOriginalRole: () => Promise<void>;
  isLoading: boolean;
  setCurrentUser: (user: User) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Map seeded test IDs so devs can switch roles without runtime errors
const TEST_USERS = {
  student: 'student-00001',
  teacher: 'teacher-00001',
  admin: 'admin-00001',
  // Use the actual Firebase Auth UID from environment variables
  dev: process.env.NEXT_PUBLIC_DEV_USER_UID || '',
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const availableRoles: UserRole[] = ['student', 'teacher', 'admin', 'dev'];

  const handleUserNotFound = async (uid: string, email: string, displayName: string | null) => {
    console.log('Creating new user for:', email);
    const nameExtraction = extractNameFromEmail(email);
    const newUserData = {
      id: uid,
      email: email,
      role: 'teacher' as UserRole, // Default role
      schoolId: '',
      name: displayName || nameExtraction.firstName || email.split('@')[0],
    };
    return await createUser(newUserData);
  };
  
  // Load initial user data
  useEffect(() => {
    const loadUserData = async () => {
      console.log('🔄 RoleProvider: loadUserData called', { 
        hasAuthUser: !!authUser, 
        authUserEmail: authUser?.email 
      });
      
      if (!authUser) {
        console.log('❌ RoleProvider: No auth user, setting loading to false');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        console.log('🔍 RoleProvider: Fetching user profile for:', authUser.uid);
        let userProfile = await getUserById(authUser.uid);
        
        if (!userProfile) {
          console.log('⚠️ RoleProvider: User profile not found, creating new user');
          userProfile = await handleUserNotFound(authUser.uid, authUser.email!, authUser.displayName);
        }

        console.log('✅ RoleProvider: User profile loaded:', userProfile);
        setOriginalUser(userProfile);
        setCurrentUser(userProfile);
        setCurrentRole(userProfile.role);
        setIsDevMode(userProfile.role === 'dev');
      } catch (error) {
        console.error('❌ RoleProvider: Failed to load user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [authUser]);

  const switchRole = async (role: UserRole) => {
    if (!originalUser) return;

    try {
      setIsLoading(true);

      if (originalUser.role !== 'dev') {
        throw new Error('Only dev users can switch roles');
      }

      if (role === 'dev') {
        setCurrentUser(originalUser);
        setCurrentRole('dev');
        setIsDevMode(true);
      } else {
        const testUserId = TEST_USERS[role];
        const testUser = await getUserById(testUserId);
        
        if (!testUser) {
          throw new Error(`Test ${role} user not found. Please run the seeding script first.`);
        }

        setCurrentUser(testUser);
        setCurrentRole(role);
        setIsDevMode(true);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const resetToOriginalRole = async () => {
    if (originalUser) {
      setCurrentUser(originalUser);
      setCurrentRole(originalUser.role);
    }
  };

  const value: RoleContextType = {
    currentRole,
    currentUser,
    availableRoles,
    isDevMode,
    switchRole,
    resetToOriginalRole,
    isLoading,
    setCurrentUser
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
} 