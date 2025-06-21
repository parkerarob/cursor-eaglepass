'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { getUserByEmail, getUserById, createUser } from '@/lib/firebase/firestore';
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
        let userProfile = await getUserByEmail(authUser.email!);
        
        if (!userProfile) {
          console.warn(`No user profile found for ${authUser.email}. Creating a new one.`);
          const newUserPayload: Omit<User, 'id'> = {
            email: authUser.email!,
            name: authUser.displayName || 'New User',
            role: 'teacher', // Default role for new users
            schoolId: '', // Default empty schoolId, can be updated in settings
          };
          userProfile = await createUser(newUserPayload);
        }

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
      const userId = TEST_USERS[role];
      if (!userId) {
        throw new Error(`No test user ID found for role: ${role}`);
      }

      newUser = await getUserById(userId);

      if (!newUser) {
        // Fallback to mock user if test user not in DB, but log a warning.
        console.warn(`Test user with ID '${userId}' for role '${role}' not found in database. Falling back to a mock user object. Profile updates will not persist.`);
        if (originalUser) {
          newUser = {
            ...originalUser,
            id: userId,
            role: role,
            name: `Mock ${role.charAt(0).toUpperCase() + role.slice(1)}`,
            email: `mock-${role}@school.com`
          };
        }
      }

      if (newUser) {
        setCurrentUser(newUser);
        setCurrentRole(role);
      } else {
        throw new Error(`Could not load or create a user for role: ${role}`);
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