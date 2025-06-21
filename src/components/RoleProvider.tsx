'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { getUserByEmail, getStudentById } from '@/lib/firebase/firestore';
import { User, UserRole } from '@/types';

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

// Test user IDs for different roles (you can modify these based on your data)
const TEST_USERS = {
  student: 'student-1',
  teacher: 'teacher-1', 
  admin: 'admin-1',
  dev: 'dev-1'
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
    if (!authUser) {
      setCurrentUser(null);
      setOriginalUser(null);
      setCurrentRole(null);
      setIsDevMode(false);
      setIsLoading(false);
      return;
    }

    const loadUserData = async () => {
      setIsLoading(true);
      try {
        const userProfile = await getUserByEmail(authUser.email!);
        if (userProfile) {
          setOriginalUser(userProfile);
          setCurrentUser(userProfile);
          setCurrentRole(userProfile.role);
          setIsDevMode(userProfile.role === 'dev');
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [authUser]);

  const switchRole = async (role: UserRole) => {
    if (!isDevMode) {
      console.warn('Role switching is only available in dev mode');
      return;
    }

    setIsLoading(true);
    try {
      let newUser: User | null = null;

      if (role === 'student') {
        // Load a test student
        newUser = await getStudentById(TEST_USERS.student);
        if (!newUser) {
          throw new Error('Test student not found. Please ensure student-1 exists in your database.');
        }
      } else {
        // For other roles, we'll create a mock user based on the original user
        if (originalUser) {
          newUser = {
            ...originalUser,
            id: TEST_USERS[role],
            role: role,
            name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
            email: `test-${role}@school.com`
          };
        }
      }

      if (newUser) {
        setCurrentUser(newUser);
        setCurrentRole(role);
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