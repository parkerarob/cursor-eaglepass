import React, { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { RoleProvider, useRole } from '../RoleProvider';
import * as AuthProvider from '../AuthProvider';
import * as firestore from '@/lib/firebase/firestore';
import * as utils from '@/lib/utils';
import { User, UserRole } from '@/types';
import { User as FirebaseUser } from 'firebase/auth';

// Mock dependencies
jest.mock('../AuthProvider');
jest.mock('@/lib/firebase/firestore');
jest.mock('@/lib/utils');

const mockUseAuth = AuthProvider.useAuth as jest.Mock;
const mockGetUserById = firestore.getUserById as jest.Mock;
const mockCreateUser = firestore.createUser as jest.Mock;
const mockExtractNameFromEmail = utils.extractNameFromEmail as jest.Mock;

const createMockFirebaseUser = (uid: string, email: string, displayName: string | null = 'Test User'): Partial<FirebaseUser> => ({
  uid,
  email,
  displayName,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <RoleProvider>{children}</RoleProvider>
);

describe('RoleProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_DEV_USER_UID = 'dev-user-uid';
    // Default to a loading auth state
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });
  });

  it('should finish loading if auth user is not present', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });
    const { result } = renderHook(() => useRole(), { wrapper });
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentUser).toBeNull();
  });

  it('should load user profile if it exists', async () => {
    const authUser = createMockFirebaseUser('user-1', 'user@example.com');
    const userProfile: User = { id: 'user-1', name: 'Test User', email: 'user@example.com', role: 'teacher', schoolId: 'school-1' };
    mockUseAuth.mockReturnValue({ user: authUser, isLoading: false });
    mockGetUserById.mockResolvedValue(userProfile);

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.currentUser).toEqual(userProfile);
    expect(result.current.currentRole).toBe('teacher');
    expect(result.current.isDevMode).toBe(false);
  });

  it('should create a new user if profile does not exist', async () => {
    const authUser = createMockFirebaseUser('user-2', 'new@example.com', 'New User');
    const newUser: User = { id: 'user-2', name: 'New User', email: 'new@example.com', role: 'teacher', schoolId: '' };
    mockUseAuth.mockReturnValue({ user: authUser, isLoading: false });
    mockGetUserById.mockResolvedValue(null);
    mockExtractNameFromEmail.mockReturnValue({ firstName: 'New', lastName: 'User' });
    mockCreateUser.mockResolvedValue(newUser);

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }));
    expect(result.current.currentUser).toEqual(newUser);
  });

  it('should enable dev mode for a dev user', async () => {
    const devUser = createMockFirebaseUser(process.env.NEXT_PUBLIC_DEV_USER_UID!, 'dev@example.com');
    const devProfile: User = { id: process.env.NEXT_PUBLIC_DEV_USER_UID!, name: 'Dev User', email: 'dev@example.com', role: 'dev', schoolId: 'school-dev' };
    mockUseAuth.mockReturnValue({ user: devUser, isLoading: false });
    mockGetUserById.mockResolvedValue(devProfile);

    const { result } = renderHook(() => useRole(), { wrapper });

    await waitFor(() => expect(result.current.isDevMode).toBe(true));
  });

  describe('Role Switching', () => {
    it('should allow a dev user to switch to another role', async () => {
        const devUser = createMockFirebaseUser(process.env.NEXT_PUBLIC_DEV_USER_UID!, 'dev@example.com');
        const devProfile: User = { id: process.env.NEXT_PUBLIC_DEV_USER_UID!, name: 'Dev User', email: 'dev@example.com', role: 'dev', schoolId: 'school-dev' };
        const adminProfile: User = { id: 'admin-00001', name: 'Admin User', email: 'admin@example.com', role: 'admin', schoolId: 'school-admin' };

        mockUseAuth.mockReturnValue({ user: devUser, isLoading: false });
        // First load the dev profile, then the admin profile for the switch
        mockGetUserById.mockResolvedValueOnce(devProfile).mockResolvedValueOnce(adminProfile);

        const { result } = renderHook(() => useRole(), { wrapper });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        
        await act(async () => {
          await result.current.switchRole('admin');
        });

        await waitFor(() => {
            expect(result.current.currentUser).toEqual(adminProfile);
            expect(result.current.currentRole).toBe('admin');
        });
    });

    it('should throw an error if a non-dev user tries to switch roles', async () => {
        const regularUser = createMockFirebaseUser('user-1', 'user@example.com');
        const regularProfile: User = { id: 'user-1', name: 'Regular User', email: 'user@example.com', role: 'teacher', schoolId: 'school-1' };
        
        mockUseAuth.mockReturnValue({ user: regularUser, isLoading: false });
        mockGetUserById.mockResolvedValue(regularProfile);

        const { result } = renderHook(() => useRole(), { wrapper });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
          await expect(result.current.switchRole('admin')).rejects.toThrow('Only dev users can switch roles');
        });
    });

    it('should throw an error for an invalid role', async () => {
        const devUser = createMockFirebaseUser(process.env.NEXT_PUBLIC_DEV_USER_UID!, 'dev@example.com');
        const devProfile: User = { id: process.env.NEXT_PUBLIC_DEV_USER_UID!, name: 'Dev User', email: 'dev@example.com', role: 'dev', schoolId: 'school-dev' };
        
        mockUseAuth.mockReturnValue({ user: devUser, isLoading: false });
        mockGetUserById.mockResolvedValueOnce(devProfile).mockResolvedValueOnce(null);
        
        const { result } = renderHook(() => useRole(), { wrapper });
        
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
          await expect(result.current.switchRole('invalid-role' as any)).rejects.toThrow('Test invalid-role user not found. Please run the seeding script first.');
        });
    });

    it('should allow a dev user to reset their role', async () => {
        const devUser = createMockFirebaseUser(process.env.NEXT_PUBLIC_DEV_USER_UID!, 'dev@example.com');
        const devProfile: User = { id: process.env.NEXT_PUBLIC_DEV_USER_UID!, name: 'Dev User', email: 'dev@example.com', role: 'dev', schoolId: 'school-dev' };
        const adminProfile: User = { id: 'admin-00001', name: 'Admin User', email: 'admin@example.com', role: 'admin', schoolId: 'school-admin' };

        mockUseAuth.mockReturnValue({ user: devUser, isLoading: false });
        mockGetUserById.mockResolvedValueOnce(devProfile).mockResolvedValueOnce(adminProfile);

        const { result } = renderHook(() => useRole(), { wrapper });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        
        // Switch to admin
        await act(async () => {
          await result.current.switchRole('admin');
        });
        await waitFor(() => expect(result.current.currentRole).toBe('admin'));

        // Reset back to dev
        await act(async () => {
          await result.current.resetToOriginalRole();
        });
        await waitFor(() => {
            expect(result.current.currentUser).toEqual(devProfile);
            expect(result.current.currentRole).toBe('dev');
        });
    });
  });
});