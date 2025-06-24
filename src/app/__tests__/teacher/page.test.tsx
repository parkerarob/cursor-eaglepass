import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeacherPage from '../../teacher/page';

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

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

// Mock Firebase functions
jest.mock('@/lib/firebase/firestore', () => ({
  getAllPasses: jest.fn(),
  getUserById: jest.fn(),
  getLocationById: jest.fn(),
  getAllLocations: jest.fn(),
  getStudentsByAssignedLocation: jest.fn(),
  getClassroomPolicy: jest.fn(),
  getEmergencyState: jest.fn(),
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
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}));

// Mock other components
jest.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

jest.mock('@/components/GlobalEmergencyBanner', () => ({
  GlobalEmergencyBanner: () => <div data-testid="emergency-banner">Emergency Banner</div>,
}));

jest.mock('@/components/FrequentFlyersCard', () => ({
  FrequentFlyersCard: ({ title }: any) => (
    <div data-testid="frequent-flyers-card">{title}</div>
  ),
}));

jest.mock('@/components/StallSitterCard', () => ({
  StallSitterCard: () => <div data-testid="stall-sitter-card">Stall Sitter Card</div>,
}));

describe('Teacher Page', () => {
  const mockTeacher = {
    id: 'teacher-1',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@school.edu',
    role: 'teacher' as const,
    assignedLocationId: 'classroom-101',
  };

  const mockLocation = {
    id: 'classroom-101',
    name: 'Room 101',
    locationType: 'classroom' as const,
  };

  const mockStudent = {
    id: 'student-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@school.edu',
    role: 'student' as const,
    assignedLocationId: 'classroom-101',
  };

  const mockPass = {
    id: 'pass-123',
    studentId: 'student-1',
    status: 'OPEN' as const,
    legs: [{
      id: 'leg-1',
      legNumber: 1,
      originLocationId: 'classroom-101',
      destinationLocationId: 'bathroom-1',
      state: 'OUT' as const,
      timestamp: new Date(),
    }],
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockAuthProvider.isLoading = true;
    mockRoleProvider.isLoading = true;

    render(<TeacherPage />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show access denied for non-teacher users', async () => {
    mockAuthProvider.user = { email: 'student@school.edu' };
    mockAuthProvider.isLoading = false;
    mockRoleProvider.currentUser = { ...mockStudent };
    mockRoleProvider.isLoading = false;

    render(<TeacherPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Access denied.*student.*does not have teacher privileges/)).toBeInTheDocument();
    });
  });

  it('should render teacher dashboard for valid teacher', async () => {
    const { getAllPasses, getUserById, getLocationById, getAllLocations, getStudentsByAssignedLocation, getEmergencyState } = require('@/lib/firebase/firestore');
    
    getAllPasses.mockResolvedValue([mockPass]);
    getUserById.mockResolvedValue(mockStudent);
    getLocationById.mockResolvedValue(mockLocation);
    getAllLocations.mockResolvedValue([mockLocation]);
    getStudentsByAssignedLocation.mockResolvedValue([mockStudent]);
    getEmergencyState.mockResolvedValue({ active: false });
    
    mockAuthProvider.user = { email: 'jane.smith@school.edu' };
    mockAuthProvider.isLoading = false;
    mockRoleProvider.currentUser = mockTeacher;
    mockRoleProvider.isLoading = false;

    render(<TeacherPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument();
    });
  });

  it('should show error when teacher has no assigned classroom', async () => {
    mockAuthProvider.user = { email: 'jane.smith@school.edu' };
    mockAuthProvider.isLoading = false;
    mockRoleProvider.currentUser = { ...mockTeacher, assignedLocationId: undefined };
    mockRoleProvider.isLoading = false;

    render(<TeacherPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Teacher is not assigned to a classroom.')).toBeInTheDocument();
    });
  });

  it('should display emergency banner', async () => {
    const { getAllPasses, getAllLocations, getStudentsByAssignedLocation, getEmergencyState } = require('@/lib/firebase/firestore');
    
    getAllPasses.mockResolvedValue([]);
    getAllLocations.mockResolvedValue([]);
    getStudentsByAssignedLocation.mockResolvedValue([]);
    getEmergencyState.mockResolvedValue({ active: false });
    
    mockAuthProvider.user = { email: 'jane.smith@school.edu' };
    mockAuthProvider.isLoading = false;
    mockRoleProvider.currentUser = mockTeacher;
    mockRoleProvider.isLoading = false;

    render(<TeacherPage />);
    
    await waitFor(() => {
      expect(screen.getByTestId('emergency-banner')).toBeInTheDocument();
    });
  });

  it('should handle no user state', () => {
    mockAuthProvider.user = null;
    mockAuthProvider.isLoading = false;
    mockRoleProvider.currentUser = null;
    mockRoleProvider.isLoading = false;

    render(<TeacherPage />);
    
    // Should not crash
    expect(screen.queryByText('Teacher Dashboard')).not.toBeInTheDocument();
  });
}); 