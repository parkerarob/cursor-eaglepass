import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminPage from '../../admin/page';

// Mock providers
const mockAuthProvider = {
  user: null as any,
  isLoading: false,
};

const mockRoleProvider = {
  currentUser: null as any,
  isLoading: false,
};

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => mockAuthProvider,
}));

jest.mock('@/components/RoleProvider', () => ({
  useRole: () => mockRoleProvider,
}));

// Mock Firebase functions
jest.mock('@/lib/firebase/firestore', () => ({
  getUserById: jest.fn(),
  getLocationById: jest.fn(),
  getEmergencyState: jest.fn(),
  setEmergencyState: jest.fn(),
  getAllLocations: jest.fn(),
  getEventLogsByDateRange: jest.fn(),
  getPassesByDateRange: jest.fn(),
  getAllPasses: jest.fn(),
}));

// Mock Firebase auth
jest.mock('@/lib/firebase/auth', () => ({
  signOut: jest.fn(),
}));

// Mock services
jest.mock('@/lib/notificationService', () => ({
  NotificationService: {
    calculateDuration: jest.fn(() => 15),
    getNotificationStatus: jest.fn(() => ({
      isOverdue: false,
      shouldEscalate: false,
      notificationLevel: 'normal',
    })),
  },
}));

jest.mock('@/lib/passService', () => ({
  PassService: {
    closePass: jest.fn(),
    claimPass: jest.fn(),
  },
}));

// Mock utilities
jest.mock('@/lib/utils', () => ({
  formatUserName: jest.fn((user) => `${user?.firstName || ''} ${user?.lastName || ''}`),
  formatDuration: jest.fn((minutes) => `${minutes} min`),
  getSortableName: jest.fn((user) => `${user?.lastName}, ${user?.firstName}`),
}));

// Mock all UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children }: any) => <button data-testid="button">{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: () => <input data-testid="input" />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <div>Select</div>,
}));

// Mock large components
jest.mock('@/components/RoleSwitcher', () => ({
  RoleSwitcher: () => <div data-testid="role-switcher">Role Switcher</div>,
}));

jest.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

jest.mock('@/components/EmergencyBanner', () => ({
  EmergencyBanner: () => <div data-testid="emergency-banner">Emergency Banner</div>,
}));

jest.mock('@/components/MonitoringDashboard', () => ({
  MonitoringDashboard: () => <div data-testid="monitoring-dashboard">Monitoring Dashboard</div>,
}));

jest.mock('@/components/FrequentFlyersCard', () => ({
  FrequentFlyersCard: () => <div data-testid="frequent-flyers-card">Frequent Flyers</div>,
}));

jest.mock('@/components/StallSitterCard', () => ({
  StallSitterCard: () => <div data-testid="stall-sitter-card">Stall Sitter</div>,
}));

jest.mock('@/components/SecurityDashboard', () => ({
  SecurityDashboard: () => <div data-testid="security-dashboard">Security Dashboard</div>,
}));

jest.mock('@/components/NotificationConfigPanel', () => ({
  NotificationConfigPanel: () => <div data-testid="notification-config">Notification Config</div>,
}));

describe('Admin Page', () => {
  const mockAdmin = {
    id: 'admin-1',
    firstName: 'Alice',
    lastName: 'Admin',
    email: 'alice.admin@school.edu',
    role: 'admin' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockAuthProvider.isLoading = true;
    mockRoleProvider.isLoading = true;

    render(<AdminPage />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render admin dashboard for admin user', async () => {
    const { getAllPasses, getAllLocations, getEmergencyState } = require('@/lib/firebase/firestore');
    
    getAllPasses.mockResolvedValue([]);
    getAllLocations.mockResolvedValue([]);
    getEmergencyState.mockResolvedValue({ active: false });
    
    mockAuthProvider.user = { email: 'alice.admin@school.edu' };
    mockAuthProvider.isLoading = false;
    mockRoleProvider.currentUser = mockAdmin;
    mockRoleProvider.isLoading = false;

    render(<AdminPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Eagle Pass Admin')).toBeInTheDocument();
    });
  });

  it('should handle no user state', () => {
    mockAuthProvider.user = null;
    mockAuthProvider.isLoading = false;
    mockRoleProvider.currentUser = null;
    mockRoleProvider.isLoading = false;

    render(<AdminPage />);
    
    // Should not crash
    expect(screen.queryByText('Eagle Pass Admin')).not.toBeInTheDocument();
  });
}); 