import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleSwitcher } from '../RoleSwitcher';
import * as RoleProvider from '../RoleProvider';
import { UserRole } from '@/types';

// Mock the RoleProvider module
jest.mock('../RoleProvider');

const mockSwitchRole = jest.fn();
const mockResetToOriginalRole = jest.fn();
const mockSetCurrentUser = jest.fn();

const mockRoleContext = {
  currentRole: 'teacher' as const,
  currentUser: { 
    id: 'test-user-1',
    email: 'test@example.com',
    role: 'teacher' as const,
    firstName: 'Test',
    lastName: 'User',
    schoolId: 'test-school'
  },
  availableRoles: ['student', 'teacher', 'admin', 'dev'] as UserRole[],
  isDevMode: true,
  switchRole: mockSwitchRole,
  resetToOriginalRole: mockResetToOriginalRole,
  isLoading: false,
  setCurrentUser: mockSetCurrentUser
};

const mockUseRole = RoleProvider.useRole as jest.MockedFunction<typeof RoleProvider.useRole>;

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${variant} ${size} ${className}`}
      data-testid="button"
    >
      {children}
    </button>
  ),
}));

// Create a mock that captures onValueChange for testing
let mockOnValueChange: any = null;

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => {
    // Store the onValueChange for the SelectTrigger to use
    mockOnValueChange = onValueChange;
    return (
      <div data-testid="select" data-value={value} data-disabled={disabled}>
        {children}
      </div>
    );
  },
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children, className, disabled }: any) => (
    <button 
      className={className} 
      data-testid="select-trigger"
      disabled={disabled}
      onClick={() => {
        // Simulate selecting 'admin' role when trigger is clicked
        if (mockOnValueChange && !disabled) {
          mockOnValueChange('admin');
        }
      }}
      role="button"
      aria-label="Select role"
    >
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={`${className} ${variant}`} data-testid="badge">{children}</span>
  ),
}));

describe('RoleSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseRole.mockReturnValue(mockRoleContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render when dev mode is enabled', () => {
    render(<RoleSwitcher />);

    expect(screen.getByText('Dev Mode')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Logged in as: test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Current role:')).toBeInTheDocument();
    expect(screen.getByText('teacher')).toBeInTheDocument();
  });

  it('should not render when dev mode is disabled', () => {
    const nonDevContext = { ...mockRoleContext, isDevMode: false };
    mockUseRole.mockReturnValue(nonDevContext);

    const { container } = render(<RoleSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('should display current user information', () => {
    render(<RoleSwitcher />);

    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.getByText('teacher')).toBeInTheDocument();
  });

  it('should display role selector with available roles', () => {
    render(<RoleSwitcher />);

    expect(screen.getByText('Switch to role:')).toBeInTheDocument();
    expect(screen.getByTestId('select')).toBeInTheDocument();
  });

  it.skip('should handle role switching', async () => {
    const user = userEvent.setup();
    mockSwitchRole.mockResolvedValueOnce(undefined);

    render(<RoleSwitcher />);

    const selectTrigger = screen.getByRole('button', { name: /select role/i });
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(mockSwitchRole).toHaveBeenCalled();
    });
  });

  it.skip('should handle role switching errors', async () => {
    const user = userEvent.setup();
    const error = new Error('Switch failed');
    mockSwitchRole.mockRejectedValueOnce(error);

    render(<RoleSwitcher />);

    const selectTrigger = screen.getByRole('button', { name: /select role/i });
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to switch role:', error);
    });
  });

  it('should handle reset to original role', async () => {
    mockResetToOriginalRole.mockResolvedValueOnce(undefined);

    render(<RoleSwitcher />);

    const resetButton = screen.getByText('Reset to Original Role');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(mockResetToOriginalRole).toHaveBeenCalled();
    });
  });

  it('should handle reset errors', async () => {
    const error = new Error('Reset failed');
    mockResetToOriginalRole.mockRejectedValueOnce(error);

    render(<RoleSwitcher />);

    const resetButton = screen.getByText('Reset to Original Role');
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to reset role:', error);
    });
  });

  it.skip('should show switching status when isSwitching is true', async () => {
    const user = userEvent.setup();
    mockSwitchRole.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<RoleSwitcher />);

    const selectTrigger = screen.getByRole('button', { name: /select role/i });
    await user.click(selectTrigger);

    // Should show switching status immediately
    expect(screen.getByText('Switching...')).toBeInTheDocument();
    expect(screen.getByText('Switching roles...')).toBeInTheDocument();

    // Wait for the switch to complete
    await waitFor(() => {
      expect(screen.queryByText('Switching...')).not.toBeInTheDocument();
    });
  });

  it('should disable controls when switching', async () => {
    const user = userEvent.setup();
    mockSwitchRole.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<RoleSwitcher />);

    const selectTrigger = screen.getByRole('button', { name: /select role/i });
    await user.click(selectTrigger);

    const select = screen.getByTestId('select');
    const resetButton = screen.getByText('Reset to Original Role');

    expect(select).toHaveAttribute('data-disabled', 'true');
    expect(resetButton).toBeDisabled();
  });

  it('should disable controls when loading', () => {
    const loadingContext = { ...mockRoleContext, isLoading: true };
    jest.mocked(require('../RoleProvider').useRole).mockReturnValue(loadingContext);

    render(<RoleSwitcher />);

    const select = screen.getByTestId('select');
    const resetButton = screen.getByText('Reset to Original Role');

    expect(select).toHaveAttribute('data-disabled', 'true');
    expect(resetButton).toBeDisabled();
  });

  it('should display correct role colors', () => {
    render(<RoleSwitcher />);

    const teacherBadge = screen.getByText('teacher');
    expect(teacherBadge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should handle different user roles with correct styling', () => {
    const adminContext = {
      ...mockRoleContext,
      currentRole: 'admin' as const
    };
    jest.mocked(require('../RoleProvider').useRole).mockReturnValue(adminContext);

    render(<RoleSwitcher />);

    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('should handle unknown role gracefully', () => {
    const unknownContext = {
      ...mockRoleContext,
      currentRole: null
    };
    jest.mocked(require('../RoleProvider').useRole).mockReturnValue(unknownContext);

    render(<RoleSwitcher />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should render with fixed positioning styling', () => {
    const { container } = render(<RoleSwitcher />);
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('fixed', 'top-4', 'right-4', 'z-50');
  });

  it('should display available roles in select content', () => {
    render(<RoleSwitcher />);

    // The select items would be rendered within SelectContent
    const selectContent = screen.getByTestId('select-content');
    expect(selectContent).toBeInTheDocument();
  });
}); 