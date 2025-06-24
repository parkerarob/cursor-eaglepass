import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page';

// Mock the AuthProvider
const mockAuthProvider = {
  user: null as any,
  isLoading: false,
};

jest.mock('@/components/AuthProvider', () => ({
  useAuth: () => mockAuthProvider,
}));

// Mock Next.js router
const mockRouter = {
  push: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// Mock Firebase auth
jest.mock('@/lib/firebase/auth', () => ({
  signOut: jest.fn(),
}));

// Mock Firebase firestore functions
jest.mock('@/lib/firebase/firestore', () => ({
  getUserById: jest.fn(),
  getActivePassByStudentId: jest.fn(),
  getUserByEmail: jest.fn(),
  getLocationById: jest.fn(),
}));

// Mock PassService
jest.mock('@/lib/passService', () => ({
  PassService: {
    getActionState: jest.fn(),
    createPass: jest.fn(),
    arriveAtDestination: jest.fn(),
    returnToClass: jest.fn(),
  },
}));

// Mock utilities
jest.mock('@/lib/utils', () => ({
  formatUserName: jest.fn((user) => `${user?.firstName || ''} ${user?.lastName || ''}`),
}));

// Mock UI components
jest.mock('@/components/PassStatus', () => ({
  PassStatus: ({ pass }: any) => (
    <div data-testid="pass-status">
      Pass Status: {pass?.status || 'No Pass'}
    </div>
  ),
}));

jest.mock('@/components/CreatePassForm', () => ({
  CreatePassForm: ({ onSubmit }: any) => (
    <div data-testid="create-pass-form">
      <button onClick={() => onSubmit({ destinationLocationId: 'bathroom-1' })}>
        Create Pass
      </button>
    </div>
  ),
}));

jest.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

jest.mock('@/components/Login', () => ({
  Login: () => <div data-testid="login">Login Component</div>,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      data-testid="button"
    >
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
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => (
    <div data-testid="card-content">
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">
      {children}
    </div>
  ),
  CardTitle: ({ children }: any) => (
    <h3 data-testid="card-title">
      {children}
    </h3>
  ),
}));

describe('Home Page (Student Interface)', () => {
  const mockUser = {
    id: 'student-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@school.edu',
    role: 'student' as const,
    assignedLocationId: 'classroom-101',
  };

  const mockLocation = {
    id: 'classroom-101',
    name: 'Room 101',
    locationType: 'classroom' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key';
  });

  it('should render login when user is not authenticated', () => {
    mockAuthProvider.user = null;
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('should show loading state when auth is loading', () => {
    mockAuthProvider.user = null;
    mockAuthProvider.isLoading = true;

    render(<Home />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show Firebase configuration error when missing env vars', () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    mockAuthProvider.user = null;
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    expect(screen.getByText(/Firebase configuration is missing/)).toBeInTheDocument();
  });

  it('should redirect teacher users to teacher interface', async () => {
    const { getUserByEmail } = require('@/lib/firebase/firestore');
    getUserByEmail.mockResolvedValue({ ...mockUser, role: 'teacher' });
    
    mockAuthProvider.user = { email: 'teacher@school.edu' };
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/teacher');
    });
  });

  it('should redirect admin users to admin interface', async () => {
    const { getUserByEmail } = require('@/lib/firebase/firestore');
    getUserByEmail.mockResolvedValue({ ...mockUser, role: 'admin' });
    
    mockAuthProvider.user = { email: 'admin@school.edu' };
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/admin');
    });
  });

  it('should display student interface for valid student', async () => {
    const { getUserByEmail, getLocationById, getActivePassByStudentId } = require('@/lib/firebase/firestore');
    const { PassService } = require('@/lib/passService');
    
    getUserByEmail.mockResolvedValue(mockUser);
    getLocationById.mockResolvedValue(mockLocation);
    getActivePassByStudentId.mockResolvedValue(null);
    PassService.getActionState.mockResolvedValue({
      isRestroomTrip: false,
      isSimpleTrip: false,
      returnLocationName: 'class',
      canArrive: false,
    });
    
    mockAuthProvider.user = { email: 'john.doe@school.edu' };
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Room 101')).toBeInTheDocument();
    });
  });

  it('should show error for unregistered user', async () => {
    const { getUserByEmail } = require('@/lib/firebase/firestore');
    getUserByEmail.mockResolvedValue(null);
    
    mockAuthProvider.user = { email: 'unregistered@school.edu' };
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText(/Your email \(unregistered@school\.edu\) is not registered/)).toBeInTheDocument();
    });
  });

  it('should handle pass creation', async () => {
    const { getUserByEmail, getLocationById, getActivePassByStudentId } = require('@/lib/firebase/firestore');
    const { PassService } = require('@/lib/passService');
    
    getUserByEmail.mockResolvedValue(mockUser);
    getLocationById.mockResolvedValue(mockLocation);
    getActivePassByStudentId.mockResolvedValue(null);
    PassService.getActionState.mockResolvedValue({
      isRestroomTrip: false,
      isSimpleTrip: false,
      returnLocationName: 'class',
      canArrive: false,
    });
    PassService.createPass.mockResolvedValue({
      success: true,
      updatedPass: {
        id: 'pass-123',
        studentId: 'student-1',
        status: 'OPEN',
        legs: [],
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });
    
    mockAuthProvider.user = { email: 'john.doe@school.edu' };
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByTestId('create-pass-form')).toBeInTheDocument();
    });

    const createButton = screen.getByText('Create Pass');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(PassService.createPass).toHaveBeenCalledWith(
        { destinationLocationId: 'bathroom-1' },
        mockUser
      );
    });
  });

  it('should handle missing assigned location error', async () => {
    const { getUserByEmail } = require('@/lib/firebase/firestore');
    
    getUserByEmail.mockResolvedValue({ ...mockUser, assignedLocationId: undefined });
    
    mockAuthProvider.user = { email: 'john.doe@school.edu' };
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByText(/Your user profile is missing an assigned classroom/)).toBeInTheDocument();
    });
  });

  it('should display theme toggle', async () => {
    const { getUserByEmail, getLocationById, getActivePassByStudentId } = require('@/lib/firebase/firestore');
    
    getUserByEmail.mockResolvedValue(mockUser);
    getLocationById.mockResolvedValue(mockLocation);
    getActivePassByStudentId.mockResolvedValue(null);
    
    mockAuthProvider.user = { email: 'john.doe@school.edu' };
    mockAuthProvider.isLoading = false;

    render(<Home />);
    
    await waitFor(() => {
      expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    });
  });
}); 