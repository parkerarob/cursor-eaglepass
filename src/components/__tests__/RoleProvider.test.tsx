import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { RoleProvider, useRole } from '../RoleProvider';
import * as AuthProvider from '../AuthProvider';
import * as firestore from '@/lib/firebase/firestore';
import * as utils from '@/lib/utils';

// Mock AuthProvider
const mockAuthContext = {
  user: null,
  isLoading: false,
  signIn: jest.fn(),
  signOut: jest.fn(),
};

jest.spyOn(AuthProvider, 'useAuth').mockImplementation(() => mockAuthContext);

// Mock firestore functions
jest.mock('@/lib/firebase/firestore', () => ({
  getUserByEmail: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  extractNameFromEmail: jest.fn(),
}));

// Test component that uses the role context
function TestComponent() {
  const {
    currentRole,
    currentUser,
    availableRoles,
    isDevMode,
    switchRole,
    resetToOriginalRole,
    isLoading,
    setCurrentUser,
  } = useRole();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not loading'}</div>
      <div data-testid="current-role">{currentRole || 'no role'}</div>
      <div data-testid="current-user">
        {currentUser ? JSON.stringify(currentUser) : 'no user'}
      </div>
      <div data-testid="available-roles">{availableRoles.join(',')}</div>
      <div data-testid="dev-mode">{isDevMode ? 'dev mode' : 'normal mode'}</div>
      <button
        onClick={() => switchRole('admin')}
        data-testid="switch-to-admin"
      >
        Switch to Admin
      </button>
      <button
        onClick={() => switchRole('teacher')}
        data-testid="switch-to-teacher"
      >
        Switch to Teacher
      </button>
      <button onClick={resetToOriginalRole} data-testid="reset-role">
        Reset Role
      </button>
      <button
        onClick={() => setCurrentUser({ id: 'test', role: 'student', email: 'test@example.com', schoolId: 'school1' })}
        data-testid="set-user"
      >
        Set User
      </button>
    </div>
  );
}

describe('RoleProvider', () => {
  const mockGetUserByEmail = firestore.getUserByEmail as jest.MockedFunction<
    typeof firestore.getUserByEmail
  >;
  const mockGetUserById = firestore.getUserById as jest.MockedFunction<
    typeof firestore.getUserById
  >;
  const mockCreateUser = firestore.createUser as jest.MockedFunction<
    typeof firestore.createUser
  >;
  const mockExtractNameFromEmail = utils.extractNameFromEmail as jest.MockedFunction<
    typeof utils.extractNameFromEmail
  >;

  const mockUser = {
    uid: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  const mockUserProfile = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'teacher' as const,
    schoolId: 'school-1',
  };

  const mockDevUser = {
    id: 'dev-1',
    email: 'dev@example.com',
    name: 'Dev User',
    role: 'dev' as const,
    schoolId: 'school-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset auth context
    mockAuthContext.user = null;
    mockAuthContext.isLoading = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw error when useRole is used outside provider', () => {
    const TestComponentOutsideProvider = () => {
      useRole();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponentOutsideProvider />)).toThrow(
      'useRole must be used within a RoleProvider'
    );

    consoleSpy.mockRestore();
  });

  it('should render initial state when no authenticated user', async () => {
    mockAuthContext.user = null;

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    expect(screen.getByTestId('current-role')).toHaveTextContent('no role');
    expect(screen.getByTestId('current-user')).toHaveTextContent('no user');
    expect(screen.getByTestId('dev-mode')).toHaveTextContent('normal mode');
  });

  it('should load existing user profile', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    expect(screen.getByTestId('current-role')).toHaveTextContent('teacher');
    expect(screen.getByTestId('current-user')).toHaveTextContent(
      JSON.stringify(mockUserProfile)
    );
    expect(screen.getByTestId('dev-mode')).toHaveTextContent('normal mode');
  });

  it('should enable dev mode for dev users', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockDevUser);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('dev mode');
    });

    expect(screen.getByTestId('current-role')).toHaveTextContent('dev');
  });

  it('should create new user when profile not found', async () => {
    const newUser = {
      ...mockUserProfile,
      id: 'new-user-1',
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(null);
    mockExtractNameFromEmail.mockReturnValue({
      firstName: 'Test',
      lastName: 'User',
      confidence: 'high' as const,
    });
    mockCreateUser.mockResolvedValue(newUser);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    expect(mockCreateUser).toHaveBeenCalledWith({
      email: 'test@example.com',
      role: 'teacher',
      schoolId: '',
      firstName: 'Test',
      lastName: 'User',
    });

    expect(screen.getByTestId('current-user')).toHaveTextContent(
      JSON.stringify(newUser)
    );
  });

  it('should create user with fallback name when extraction confidence is low', async () => {
    const newUser = {
      ...mockUserProfile,
      id: 'new-user-1',
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(null);
    mockExtractNameFromEmail.mockReturnValue({
      firstName: 'Test',
      lastName: 'User',
      confidence: 'low' as const,
    });
    mockCreateUser.mockResolvedValue(newUser);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        role: 'teacher',
        schoolId: '',
        name: 'Test User',
      });
    });
  });

  it('should create user with email fallback when no display name', async () => {
    const userWithoutDisplayName = {
      ...mockUser,
      displayName: undefined,
    };

    mockAuthContext.user = userWithoutDisplayName;
    mockGetUserByEmail.mockResolvedValue(null);
    mockExtractNameFromEmail.mockReturnValue({
      firstName: 'Test',
      lastName: 'User',
      confidence: 'low' as const,
    });
    mockCreateUser.mockResolvedValue(mockUserProfile);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        role: 'teacher',
        schoolId: '',
        name: 'test',
      });
    });
  });

  it('should handle user data loading errors', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockRejectedValue(new Error('Database error'));

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    expect(console.error).toHaveBeenCalledWith('Failed to load user data:', expect.any(Error));
  });

  it('should display available roles', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('available-roles')).toHaveTextContent('student,teacher,admin,dev');
    });
  });

  it('should switch roles in dev mode', async () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin' as const,
      schoolId: 'school-1',
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockDevUser);
    mockGetUserById.mockResolvedValue(adminUser);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('dev mode');
    });

    const switchButton = screen.getByTestId('switch-to-admin');
    act(() => {
      switchButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-role')).toHaveTextContent('admin');
    });

    expect(screen.getByTestId('current-user')).toHaveTextContent(
      JSON.stringify(adminUser)
    );
  });

  it('should not switch roles in normal mode', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('normal mode');
    });

    const switchButton = screen.getByTestId('switch-to-admin');
    act(() => {
      switchButton.click();
    });

    // Role should not change
    expect(screen.getByTestId('current-role')).toHaveTextContent('teacher');
    expect(console.warn).toHaveBeenCalledWith('Role switching is only available in dev mode');
  });

  it('should fallback to mock user when test user not found', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockDevUser);
    mockGetUserById.mockResolvedValue(null);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('dev mode');
    });

    const switchButton = screen.getByTestId('switch-to-admin');
    act(() => {
      switchButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-role')).toHaveTextContent('admin');
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Test user with ID 'admin-1' for role 'admin' not found in database")
    );
  });

  it('should handle role switch errors', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockDevUser);
    mockGetUserById.mockRejectedValue(new Error('Database error'));

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('dev mode');
    });

    const switchButton = screen.getByTestId('switch-to-admin');
    
    await act(async () => {
      switchButton.click();
    });

    expect(console.error).toHaveBeenCalledWith('Failed to switch role:', expect.any(Error));
  });

  it('should reset to original role', async () => {
    const adminUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin' as const,
      schoolId: 'school-1',
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockDevUser);
    mockGetUserById.mockResolvedValue(adminUser);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-role')).toHaveTextContent('dev');
    });

    // Switch to admin
    const switchButton = screen.getByTestId('switch-to-admin');
    act(() => {
      switchButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-role')).toHaveTextContent('admin');
    });

    // Reset to original
    const resetButton = screen.getByTestId('reset-role');
    act(() => {
      resetButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-role')).toHaveTextContent('dev');
    });

    expect(screen.getByTestId('current-user')).toHaveTextContent(
      JSON.stringify(mockDevUser)
    );
  });

  it('should handle setCurrentUser', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-role')).toHaveTextContent('teacher');
    });

    const setUserButton = screen.getByTestId('set-user');
    act(() => {
      setUserButton.click();
    });

    const expectedUser = { id: 'test', role: 'student', email: 'test@example.com', schoolId: 'school1' };
    expect(screen.getByTestId('current-user')).toHaveTextContent(
      JSON.stringify(expectedUser)
    );
  });

  it('should handle role switch when no original user', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockDevUser);
    mockGetUserById.mockResolvedValue(null);

    // Mock a scenario where originalUser is null
    const { rerender } = render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('dev mode');
    });

    // Force originalUser to be null by clearing auth user and re-rendering
    mockAuthContext.user = null;
    rerender(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    mockAuthContext.user = { ...mockUser, email: 'test2@example.com' };
    mockGetUserByEmail.mockResolvedValue(mockDevUser);
    
    rerender(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('dev mode');
    });

    const switchButton = screen.getByTestId('switch-to-admin');
    act(() => {
      switchButton.click();
    });

    // Should still attempt to switch even without originalUser
    await waitFor(() => {
      expect(mockGetUserById).toHaveBeenCalledWith('admin-1');
    });
  });

  it('should handle role switch with invalid role', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockDevUser);

    render(
      <RoleProvider>
        <TestComponent />
      </RoleProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-mode')).toHaveTextContent('dev mode');
    });

    // Manually trigger switchRole with invalid role
    const { switchRole } = useRole();
    
    await act(async () => {
      try {
        await switchRole('invalid-role' as any);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(console.error).toHaveBeenCalledWith('Failed to switch role:', expect.any(Error));
  });
});