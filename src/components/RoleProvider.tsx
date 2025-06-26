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

  // Load initial user data
  useEffect(() => {
    const loadUserData = async () => {
      if (!authUser?.email) {
        setIsLoading(false);
        return;
      }

      try {
        // First, try to get user by Firebase Auth UID
        let userProfile = await getUserById(authUser.uid);
        
        // If not found by UID, try by email (legacy support)
        if (!userProfile) {
          userProfile = await getUserByEmail(authUser.email);
        }
        
        // If still not found, create a new user
        if (!userProfile) {
          console.log('Creating new user for:', authUser.email);
          const nameExtraction = extractNameFromEmail(authUser.email);
          const newUserData = {
            email: authUser.email,
            role: 'teacher' as UserRole, // Default role
            schoolId: '',
            name: authUser.displayName || nameExtraction.firstName,
          };
          userProfile = await createUser(newUserData);
        }

        setOriginalUser(userProfile);
        setCurrentUser(userProfile);
        setCurrentRole(userProfile.role);
        setIsDevMode(userProfile.role === 'dev');
      } catch (error) {
        console.error('Failed to load user data:', error);
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
      console.error('Failed to switch role:', error);
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