import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentDetailPage from '../../../../../admin/reports/student/[name]/page';

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}));

// Mock Firebase functions
jest.mock('@/lib/firebase/firestore', () => ({
  getPassesByStudentName: jest.fn(),
  getLocationById: jest.fn(),
  getUserById: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant }: any) => (
    <button onClick={onClick} data-testid="button" data-variant={variant}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => (
    <span data-testid="badge" className={className}>{children}</span>
  ),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="arrow-left-icon">←</div>,
  Clock: () => <div data-testid="clock-icon">🕐</div>,
  Calendar: () => <div data-testid="calendar-icon">📅</div>,
  User: () => <div data-testid="user-icon">👤</div>,
  MapPin: () => <div data-testid="map-pin-icon">📍</div>,
  FileText: () => <div data-testid="file-text-icon">📄</div>,
  Navigation: () => <div data-testid="navigation-icon">🧭</div>,
}));

describe('StudentDetailPage', () => {
  const mockStudent = {
    id: 'student1',
    firstName: 'Alice',
    lastName: 'Johnson',
    role: 'student',
  };

  const mockLocation1 = {
    id: 'loc1',
    name: 'Classroom 101',
    type: 'classroom',
  };

  const mockLocation2 = {
    id: 'loc2',
    name: 'Main Bathroom',
    type: 'bathroom',
  };

  const mockPasses = [
    {
      id: 'pass1',
      studentId: 'student1',
      status: 'OPEN',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:05:00Z'),
      durationMinutes: 5,
      legs: [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          state: 'OUT',
          originLocationId: 'loc1',
          destinationLocationId: 'loc2',
        },
        {
          timestamp: new Date('2024-01-01T10:05:00Z'),
          state: 'IN',
          originLocationId: 'loc1',
          destinationLocationId: 'loc2',
        },
      ],
    },
    {
      id: 'pass2',
      studentId: 'student1',
      status: 'CLOSED',
      createdAt: new Date('2024-01-02T14:00:00Z'),
      updatedAt: new Date('2024-01-02T14:10:00Z'),
      durationMinutes: 10,
      legs: [
        {
          timestamp: new Date('2024-01-02T14:00:00Z'),
          state: 'OUT',
          originLocationId: 'loc1',
          destinationLocationId: 'loc2',
        },
      ],
    },
  ];

  const mockRouter = {
    back: jest.fn(),
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Next.js hooks
    const { useParams, useRouter } = require('next/navigation');
    useParams.mockReturnValue({ name: 'Alice%20Johnson' });
    useRouter.mockReturnValue(mockRouter);

    // Mock Firebase functions
    const { getPassesByStudentName, getLocationById, getUserById } = require('@/lib/firebase/firestore');
    getPassesByStudentName.mockResolvedValue(mockPasses);
    getUserById.mockResolvedValue(mockStudent);
    getLocationById.mockImplementation((id: string) => {
      if (id === 'loc1') return Promise.resolve(mockLocation1);
      if (id === 'loc2') return Promise.resolve(mockLocation2);
      return Promise.resolve(null);
    });
  });

  it('should render student detail page', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<StudentDetailPage />);

    expect(screen.getByText('Loading student data...')).toBeInTheDocument();
  });

  it('should display pass count', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('2 total passes')).toBeInTheDocument();
    });
  });

  it('should display pass history card', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Pass History')).toBeInTheDocument();
      expect(screen.getByText('Click on any pass to view detailed information')).toBeInTheDocument();
    });
  });

  it('should display all passes', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('OPEN')).toBeInTheDocument();
      expect(screen.getByText('CLOSED')).toBeInTheDocument();
    });
  });

  it('should display pass locations', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Bathroom')).toBeInTheDocument();
    });
  });

  it('should display pass durations', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('5 min')).toBeInTheDocument();
      expect(screen.getByText('10 min')).toBeInTheDocument();
    });
  });

  it('should handle pass selection', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      const passElements = screen.getAllByTestId('badge');
      fireEvent.click(passElements[0].closest('div')!);
    });

    // Should highlight selected pass
    await waitFor(() => {
      const passContainer = screen.getAllByTestId('badge')[0].closest('div');
      expect(passContainer).toHaveClass('border-blue-500');
    });
  });

  it('should format dates correctly', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 2, 2024/)).toBeInTheDocument();
    });
  });

  it('should handle back button click', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);
    });

    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('should display no passes message when no data', async () => {
    const { getPassesByStudentName } = require('@/lib/firebase/firestore');
    getPassesByStudentName.mockResolvedValue([]);

    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('No passes found for this student')).toBeInTheDocument();
    });
  });

  it('should handle Firebase error gracefully', async () => {
    const { getPassesByStudentName } = require('@/lib/firebase/firestore');
    getPassesByStudentName.mockRejectedValue(new Error('Firebase error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading passes:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should decode URL-encoded student name', async () => {
    const { useParams } = require('next/navigation');
    useParams.mockReturnValue({ name: 'Alice%20Johnson%20Jr.' });

    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson Jr.')).toBeInTheDocument();
    });
  });

  it('should display status colors correctly', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      const openBadge = screen.getByText('OPEN');
      const closedBadge = screen.getByText('CLOSED');
      
      expect(openBadge).toHaveClass('bg-green-100', 'text-green-800');
      expect(closedBadge).toHaveClass('bg-blue-100', 'text-blue-800');
    });
  });

  it('should handle missing student data', async () => {
    const { getUserById } = require('@/lib/firebase/firestore');
    getUserById.mockResolvedValue(null);

    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('should handle missing location data', async () => {
    const { getLocationById } = require('@/lib/firebase/firestore');
    getLocationById.mockResolvedValue(null);

    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Unknown Location')).toBeInTheDocument();
    });
  });

  it('should display teacher information', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Teacher')).toBeInTheDocument();
    });
  });

  it('should handle pass click highlighting', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      const passContainers = screen.getAllByText('OPEN')[0].closest('div');
      fireEvent.click(passContainers!);
    });

    await waitFor(() => {
      expect(passContainers).toHaveClass('border-blue-500', 'bg-blue-50');
    });
  });

  it('should display pass details section when pass is selected', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      const passContainer = screen.getAllByText('OPEN')[0].closest('div');
      fireEvent.click(passContainer!);
    });

    await waitFor(() => {
      expect(screen.getByText('Pass Details')).toBeInTheDocument();
    });
  });

  it('should display icons correctly', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
    });
  });

  it('should handle empty legs array', async () => {
    const passWithoutLegs = {
      ...mockPasses[0],
      legs: [],
    };
    
    const { getPassesByStudentName } = require('@/lib/firebase/firestore');
    getPassesByStudentName.mockResolvedValue([passWithoutLegs]);

    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  it('should display pass journey correctly', async () => {
    render(<StudentDetailPage />);

    await waitFor(() => {
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByTestId('map-pin-icon')).toBeInTheDocument();
    });
  });
}); 