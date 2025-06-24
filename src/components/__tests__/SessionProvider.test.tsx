import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SessionProvider, useSession } from '../SessionProvider';
import * as AuthProvider from '../AuthProvider';
import * as firestore from '@/lib/firebase/firestore';

// Mock fetch globally
global.fetch = jest.fn();

// Mock AuthProvider
const mockAuthContext = {
  user: null,
  isLoading: false,
  signIn: jest.fn(),
  signOut: jest.fn(),
};

jest.spyOn(AuthProvider, 'useAuth').mockImplementation(() => mockAuthContext);

// Mock firestore
jest.mock('@/lib/firebase/firestore', () => ({
  getUserByEmail: jest.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test component that uses the session context
function TestComponent() {
  const {
    sessionData,
    isLoading,
    error,
    refreshSession,
    logout,
    sessionExpiresAt,
    timeUntilExpiry,
  } = useSession();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not loading'}</div>
      <div data-testid="error">{error || 'no error'}</div>
      <div data-testid="session-data">
        {sessionData ? JSON.stringify(sessionData) : 'no session'}
      </div>
      <div data-testid="expires-at">
        {sessionExpiresAt ? sessionExpiresAt.toISOString() : 'no expiry'}
      </div>
      <div data-testid="time-until-expiry">
        {timeUntilExpiry !== null ? timeUntilExpiry.toString() : 'no countdown'}
      </div>
      <button onClick={refreshSession} data-testid="refresh-button">
        Refresh Session
      </button>
      <button onClick={logout} data-testid="logout-button">
        Logout
      </button>
    </div>
  );
}

describe('SessionProvider', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  const mockGetUserByEmail = firestore.getUserByEmail as jest.MockedFunction<
    typeof firestore.getUserByEmail
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
    role: 'teacher',
    schoolId: 'school-1',
  };

  const mockSessionData = {
    userId: 'user-1',
    email: 'test@example.com',
    role: 'teacher',
    schoolId: 'school-1',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-12-15T14:30:00Z'));
    
    // Reset auth context
    mockAuthContext.user = null;
    mockAuthContext.isLoading = false;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should throw error when useSession is used outside provider', () => {
    const TestComponentOutsideProvider = () => {
      useSession();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponentOutsideProvider />)).toThrow(
      'useSession must be used within a SessionProvider'
    );

    consoleSpy.mockRestore();
  });

  it('should render loading state when auth is loading', () => {
    mockAuthContext.isLoading = true;

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
  });

  it('should clear session when no authenticated user', async () => {
    mockAuthContext.user = null;
    mockAuthContext.isLoading = false;

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
    expect(screen.getByTestId('expires-at')).toHaveTextContent('no expiry');
  });

  it('should initialize session when user is authenticated', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: mockSessionData }),
    } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    expect(screen.getByTestId('session-data')).toHaveTextContent(
      JSON.stringify(mockSessionData)
    );
    expect(screen.getByTestId('error')).toHaveTextContent('no error');
  });

  it('should handle session initialization error when user profile not found', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(null);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('User profile not found');
    });

    expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
  });

  it('should logout when session fetch fails during initialization', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    // Should have called logout API
    expect(mockFetch).toHaveBeenCalledWith('/api/session/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('should update time until expiry countdown', async () => {
    const futureTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    const sessionWithShortExpiry = {
      ...mockSessionData,
      expiresAt: futureTime.toISOString(),
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: sessionWithShortExpiry }),
    } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(sessionWithShortExpiry)
      );
    });

    // Should show countdown
    expect(screen.getByTestId('time-until-expiry')).not.toHaveTextContent('no countdown');

    // Advance time by 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Countdown should decrease
    const newTimeUntilExpiry = parseInt(
      screen.getByTestId('time-until-expiry').textContent || '0'
    );
    expect(newTimeUntilExpiry).toBeLessThan(10 * 60 * 1000);
  });

  it('should auto-logout when session expires', async () => {
    const soonToExpireTime = new Date(Date.now() + 1000); // 1 second from now
    const sessionExpiringSoon = {
      ...mockSessionData,
      expiresAt: soonToExpireTime.toISOString(),
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: sessionExpiringSoon }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(sessionExpiringSoon)
      );
    });

    // Advance time past expiry
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
    });

    // Should have called logout API
    expect(mockFetch).toHaveBeenCalledWith('/api/session/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('should auto-refresh session when approaching expiry', async () => {
    const approachingExpiryTime = new Date(Date.now() + 4 * 60 * 1000); // 4 minutes from now
    const sessionApproachingExpiry = {
      ...mockSessionData,
      expiresAt: approachingExpiryTime.toISOString(),
    };

    const refreshedSession = {
      ...mockSessionData,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: sessionApproachingExpiry }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: refreshedSession }),
      } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(sessionApproachingExpiry)
      );
    });

    // Advance time to trigger auto-refresh
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/session/refresh', {
        method: 'POST',
        credentials: 'include',
      });
    });
  });

  it('should handle manual refresh session', async () => {
    const refreshedSession = {
      ...mockSessionData,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    };

    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: mockSessionData }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: refreshedSession }),
      } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(mockSessionData)
      );
    });

    // Click refresh button
    const refreshButton = screen.getByTestId('refresh-button');
    act(() => {
      refreshButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(refreshedSession)
      );
    });
  });

  it('should handle failed refresh by logging out', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: mockSessionData }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(mockSessionData)
      );
    });

    // Click refresh button
    const refreshButton = screen.getByTestId('refresh-button');
    act(() => {
      refreshButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
    });

    // Should have called logout API
    expect(mockFetch).toHaveBeenCalledWith('/api/session/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('should handle manual logout', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: mockSessionData }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(mockSessionData)
      );
    });

    // Click logout button
    const logoutButton = screen.getByTestId('logout-button');
    act(() => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
    });

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sessionToken');
  });

  it('should handle logout API failure gracefully', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: mockSessionData }),
      } as Response)
      .mockRejectedValueOnce(new Error('Network error'));

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(mockSessionData)
      );
    });

    // Click logout button
    const logoutButton = screen.getByTestId('logout-button');
    act(() => {
      logoutButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
    });

    // Should still clear local session even if API fails
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sessionToken');
  });

  it('should handle fetch session API errors', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not loading');
    });

    // Should have cleared session
    expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
  });

  it('should handle refresh session API errors', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session: mockSessionData }),
      } as Response)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(mockSessionData)
      );
    });

    // Click refresh button
    const refreshButton = screen.getByTestId('refresh-button');
    act(() => {
      refreshButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
    });

    // Should have called logout due to refresh error
    expect(mockFetch).toHaveBeenCalledWith('/api/session/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('should clean up intervals on unmount', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockResolvedValue(mockUserProfile);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session: mockSessionData }),
    } as Response);

    const { unmount } = render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-data')).toHaveTextContent(
        JSON.stringify(mockSessionData)
      );
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should handle user profile fetch errors', async () => {
    mockAuthContext.user = mockUser;
    mockGetUserByEmail.mockRejectedValue(new Error('Database error'));

    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Database error');
    });

    expect(screen.getByTestId('session-data')).toHaveTextContent('no session');
  });
});