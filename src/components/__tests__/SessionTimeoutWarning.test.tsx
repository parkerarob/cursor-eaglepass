import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionTimeoutWarning } from '../SessionTimeoutWarning';

// Mock the SessionProvider hook
const mockRefreshSession = jest.fn();
const mockLogout = jest.fn();

const mockSessionContext = {
  timeUntilExpiry: 4 * 60 * 1000, // 4 minutes
  refreshSession: mockRefreshSession,
  logout: mockLogout
};

jest.mock('../SessionProvider', () => ({
  useSession: () => mockSessionContext
}));

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => (
    <div className={className} data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children, className }: any) => (
    <h2 className={className} data-testid="dialog-title">{children}</h2>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, className }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${variant} ${className}`}
      data-testid="button"
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>{children}</div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Clock: ({ className }: any) => <div className={className} data-testid="clock-icon" />,
  AlertTriangle: ({ className }: any) => <div className={className} data-testid="alert-triangle-icon" />,
}));

describe('SessionTimeoutWarning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show warning when time until expiry is within threshold', () => {
    render(<SessionTimeoutWarning />);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Session Timeout Warning')).toBeInTheDocument();
    expect(screen.getByText(/Your session will expire in 4m 0s/)).toBeInTheDocument();
  });

  it('should not show warning when time until expiry is above threshold', () => {
    const longTimeContext = { ...mockSessionContext, timeUntilExpiry: 10 * 60 * 1000 };
    jest.mocked(require('../SessionProvider').useSession).mockReturnValue(longTimeContext);

    render(<SessionTimeoutWarning />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should not show warning when timeUntilExpiry is null', () => {
    const nullTimeContext = { ...mockSessionContext, timeUntilExpiry: null };
    jest.mocked(require('../SessionProvider').useSession).mockReturnValue(nullTimeContext);

    render(<SessionTimeoutWarning />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should show critical warning when time is very low', () => {
    const criticalContext = { ...mockSessionContext, timeUntilExpiry: 30 * 1000 }; // 30 seconds
    jest.mocked(require('../SessionProvider').useSession).mockReturnValue(criticalContext);

    render(<SessionTimeoutWarning />);

    expect(screen.getByTestId('alert')).toHaveAttribute('data-variant', 'destructive');
    expect(screen.getByText(/Your session will expire in 30s!/)).toBeInTheDocument();
  });

  it('should handle refresh session action', async () => {
    mockRefreshSession.mockResolvedValueOnce(undefined);

    render(<SessionTimeoutWarning />);

    const extendButton = screen.getByText('Extend Session');
    fireEvent.click(extendButton);

    expect(screen.getByText('Extending...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockRefreshSession).toHaveBeenCalled();
    });
  });

  it('should handle logout action', async () => {
    mockLogout.mockResolvedValueOnce(undefined);

    render(<SessionTimeoutWarning />);

    const logoutButton = screen.getByText('Logout Now');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('should handle refresh session error', async () => {
    const error = new Error('Refresh failed');
    mockRefreshSession.mockRejectedValueOnce(error);

    render(<SessionTimeoutWarning />);

    const extendButton = screen.getByText('Extend Session');
    fireEvent.click(extendButton);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to refresh session:', error);
    });
  });

  it('should format time correctly for different values', () => {
    const twoMinutesContext = { ...mockSessionContext, timeUntilExpiry: 2 * 60 * 1000 + 30 * 1000 };
    jest.mocked(require('../SessionProvider').useSession).mockReturnValue(twoMinutesContext);

    render(<SessionTimeoutWarning />);

    expect(screen.getByText(/2m 30s/)).toBeInTheDocument();
  });

  it('should format time correctly for seconds only', () => {
    const secondsOnlyContext = { ...mockSessionContext, timeUntilExpiry: 45 * 1000 };
    jest.mocked(require('../SessionProvider').useSession).mockReturnValue(secondsOnlyContext);

    render(<SessionTimeoutWarning />);

    expect(screen.getByText(/45s!/)).toBeInTheDocument();
  });

  it('should disable buttons when refreshing', async () => {
    mockRefreshSession.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<SessionTimeoutWarning />);

    const extendButton = screen.getByText('Extend Session');
    const logoutButton = screen.getByText('Logout Now');

    fireEvent.click(extendButton);

    expect(extendButton).toBeDisabled();
    expect(logoutButton).toBeDisabled();
  });

  it('should show appropriate icon for normal warning', () => {
    render(<SessionTimeoutWarning />);

    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
  });

  it('should show appropriate icon for critical warning', () => {
    const criticalContext = { ...mockSessionContext, timeUntilExpiry: 30 * 1000 };
    jest.mocked(require('../SessionProvider').useSession).mockReturnValue(criticalContext);

    render(<SessionTimeoutWarning />);

    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
  });
});
