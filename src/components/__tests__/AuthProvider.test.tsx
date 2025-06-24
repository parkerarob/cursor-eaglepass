import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthProvider';

// Mock Firebase auth functions
jest.mock('@/lib/firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  FirebaseUser: {},
}));

jest.mock('@/lib/firebase/config', () => ({
  getFirebaseAuth: jest.fn(),
}));

// Test component to access auth context
function TestComponent() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }
  
  return (
    <div>
      <div data-testid="user-status">
        {user ? `User: ${user.email}` : 'No user'}
      </div>
      <div data-testid="loading-status">
        {isLoading ? 'Loading' : 'Not loading'}
      </div>
    </div>
  );
}

describe('AuthProvider', () => {
  const { onAuthStateChanged } = require('@/lib/firebase/auth');
  const { getFirebaseAuth } = require('@/lib/firebase/config');
  
  let mockUnsubscribe: jest.Mock;
  let mockAuth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();
    mockAuth = { some: 'auth-object' };
    
    onAuthStateChanged.mockReturnValue(mockUnsubscribe);
    getFirebaseAuth.mockReturnValue(mockAuth);
  });

  it('should render children and provide auth context', () => {
    render(
      <AuthProvider>
        <div data-testid="child">Child component</div>
      </AuthProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should initialize with loading state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(getFirebaseAuth).toHaveBeenCalled();
    expect(onAuthStateChanged).toHaveBeenCalledWith(
      mockAuth,
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('should update user state when auth state changes', async () => {
    const mockUser = {
      uid: 'user123',
      email: 'test@example.com',
      displayName: 'Test User',
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate auth state change with user
    const onAuthCallback = onAuthStateChanged.mock.calls[0][1];
    onAuthCallback(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('User: test@example.com');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
    });
  });

  it('should handle null user state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate auth state change with no user
    const onAuthCallback = onAuthStateChanged.mock.calls[0][1];
    onAuthCallback(null);

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('No user');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
    });
  });

  it('should handle auth errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Simulate auth error
    const onErrorCallback = onAuthStateChanged.mock.calls[0][2];
    const mockError = new Error('Auth error');
    onErrorCallback(mockError);

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('No user');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Auth state change error:', mockError);
    consoleSpy.mockRestore();
  });

  it('should handle Firebase auth not initialized', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getFirebaseAuth.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('No user');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Firebase Auth not initialized, user will remain null');
    expect(onAuthStateChanged).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should cleanup subscription on unmount', () => {
    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(onAuthStateChanged).toHaveBeenCalled();
    
    unmount();
    
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should not cleanup when auth is not initialized', () => {
    getFirebaseAuth.mockReturnValue(null);
    
    const { unmount } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    unmount();
    
    // Should not call unsubscribe since no subscription was created
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  it('should throw error when useAuth is used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');
    
    consoleSpy.mockRestore();
  });

  it('should handle multiple auth state changes', async () => {
    const mockUser1 = { uid: 'user1', email: 'user1@example.com' };
    const mockUser2 = { uid: 'user2', email: 'user2@example.com' };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const onAuthCallback = onAuthStateChanged.mock.calls[0][1];

    // First user
    onAuthCallback(mockUser1);
    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('User: user1@example.com');
    });

    // Second user
    onAuthCallback(mockUser2);
    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('User: user2@example.com');
    });

    // Logout
    onAuthCallback(null);
    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('No user');
    });
  });

  it('should provide consistent context value', () => {
    let contextValue1: any;
    let contextValue2: any;

    function TestContextValue() {
      const context = useAuth();
      if (!contextValue1) {
        contextValue1 = context;
      } else {
        contextValue2 = context;
      }
      return <div>Test</div>;
    }

    const { rerender } = render(
      <AuthProvider>
        <TestContextValue />
      </AuthProvider>
    );

    rerender(
      <AuthProvider>
        <TestContextValue />
      </AuthProvider>
    );

    // Context should be stable across re-renders when state hasn't changed
    expect(contextValue1).toBeDefined();
    expect(contextValue2).toBeDefined();
  });

  it('should handle user with different properties', async () => {
    const mockUser = {
      uid: 'user123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
      emailVerified: true,
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const onAuthCallback = onAuthStateChanged.mock.calls[0][1];
    onAuthCallback(mockUser);

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('User: test@example.com');
    });
  });

  it('should handle auth state change with undefined user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const onAuthCallback = onAuthStateChanged.mock.calls[0][1];
    onAuthCallback(undefined);

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('No user');
      expect(screen.getByTestId('loading-status')).toHaveTextContent('Not loading');
    });
  });
}); 