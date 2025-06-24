import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PassStatus } from '../PassStatus';
import { Pass, Location } from '@/types';

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
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
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  ),
}));

// Mock Firebase function
const mockGetLocationById = jest.fn();
jest.mock('@/lib/firebase/firestore', () => ({
  getLocationById: (id: string) => mockGetLocationById(id),
}));

describe('PassStatus Component', () => {
  const mockCurrentLocation: Location = {
    id: 'classroom-101',
    name: 'Classroom 101',
    locationType: 'classroom'
  };

  const mockDestinationLocation: Location = {
    id: 'bathroom-main',
    name: 'Main Bathroom',
    locationType: 'bathroom'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocationById.mockResolvedValue(mockDestinationLocation);
  });

  it('should render no active pass state', () => {
    render(
      <PassStatus 
        pass={null} 
        currentLocation={mockCurrentLocation} 
      />
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('No Active Pass');
    expect(screen.getByText("You're currently in Classroom 101")).toBeInTheDocument();
    expect(screen.getByText('IN CLASS')).toBeInTheDocument();
    
    const badges = screen.getAllByTestId('badge');
    const inClassBadge = badges.find(badge => badge.textContent === 'IN CLASS');
    expect(inClassBadge).toHaveAttribute('data-variant', 'success');
  });

  it('should render active pass with OUT state', async () => {
    const mockPass: Pass = {
      id: 'pass-123',
      studentId: 'student-456',
      status: 'OPEN',
      createdAt: new Date('2024-01-15T10:30:00Z'),
      lastUpdatedAt: new Date('2024-01-15T10:30:00Z'),
      legs: [{
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-101',
        destinationLocationId: 'bathroom-main',
        state: 'OUT',
        timestamp: new Date('2024-01-15T10:30:00Z')
      }]
    };

    render(
      <PassStatus 
        pass={mockPass} 
        currentLocation={mockCurrentLocation} 
      />
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Active Pass');
    expect(screen.getByText('OUT to:')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Main Bathroom')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('badge');
    const openBadge = badges.find(badge => badge.textContent === 'OPEN');
    const outBadge = badges.find(badge => badge.textContent === 'OUT');
    
    expect(openBadge).toHaveAttribute('data-variant', 'info');
    expect(outBadge).toHaveAttribute('data-variant', 'warning');

    expect(screen.getByText(/Started: \d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText("You're on your way")).toBeInTheDocument();
  });

  it('should render active pass with IN state', async () => {
    const mockPass: Pass = {
      id: 'pass-123',
      studentId: 'student-456',
      status: 'OPEN',
      createdAt: new Date('2024-01-15T10:30:00Z'),
      lastUpdatedAt: new Date('2024-01-15T10:30:00Z'),
      legs: [{
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-101',
        destinationLocationId: 'bathroom-main',
        state: 'IN',
        timestamp: new Date('2024-01-15T10:30:00Z')
      }]
    };

    render(
      <PassStatus 
        pass={mockPass} 
        currentLocation={mockCurrentLocation} 
      />
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Active Pass');
    expect(screen.getByText('IN')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Main Bathroom')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('badge');
    const openBadge = badges.find(badge => badge.textContent === 'OPEN');
    const inBadge = badges.find(badge => badge.textContent === 'IN');
    
    expect(openBadge).toHaveAttribute('data-variant', 'info');
    expect(inBadge).toHaveAttribute('data-variant', 'success');

    expect(screen.getByText(/Arrived: \d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText("You've arrived")).toBeInTheDocument();
  });

  it('should render closed pass', async () => {
    const mockPass: Pass = {
      id: 'pass-123',
      studentId: 'student-456',
      status: 'CLOSED',
      legs: [{
        id: 'leg-1',
        destinationLocationId: 'bathroom-main',
        state: 'IN',
        timestamp: new Date('2024-01-15T10:30:00Z')
      }]
    };

    render(
      <PassStatus 
        pass={mockPass} 
        currentLocation={mockCurrentLocation} 
      />
    );

    expect(screen.getByTestId('card-title')).toHaveTextContent('Active Pass');
    
    await waitFor(() => {
      expect(screen.getByText('Main Bathroom')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('badge');
    const closedBadge = badges.find(badge => badge.textContent === 'CLOSED');
    expect(closedBadge).toHaveAttribute('data-variant', 'secondary');

    expect(screen.getByText(/Arrived: \d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.queryByText("You've arrived")).not.toBeInTheDocument();
  });

  it('should show loading state for destination location', () => {
    const mockPass: Pass = {
      id: 'pass-123',
      studentId: 'student-456',
      status: 'OPEN',
      legs: [{
        id: 'leg-1',
        destinationLocationId: 'bathroom-main',
        state: 'OUT',
        timestamp: new Date('2024-01-15T10:30:00Z')
      }]
    };

    // Mock slow response
    mockGetLocationById.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve(mockDestinationLocation), 1000);
    }));

    render(
      <PassStatus 
        pass={mockPass} 
        currentLocation={mockCurrentLocation} 
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle multiple legs and use the last one', async () => {
    const mockPass: Pass = {
      id: 'pass-123',
      studentId: 'student-456',
      status: 'OPEN',
      legs: [
        {
          id: 'leg-1',
          destinationLocationId: 'bathroom-main',
          state: 'OUT',
          timestamp: new Date('2024-01-15T10:30:00Z')
        },
        {
          id: 'leg-2',
          destinationLocationId: 'library',
          state: 'IN',
          timestamp: new Date('2024-01-15T10:35:00Z')
        }
      ]
    };

    const libraryLocation: Location = {
      id: 'library',
      name: 'Library',
      type: 'LIBRARY',
      allowedDestinations: []
    };

    mockGetLocationById.mockResolvedValue(libraryLocation);

    render(
      <PassStatus 
        pass={mockPass} 
        currentLocation={mockCurrentLocation} 
      />
    );

    expect(screen.getByText('IN')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Library')).toBeInTheDocument();
    });

    expect(mockGetLocationById).toHaveBeenCalledWith('library');
    expect(screen.getByText(/Arrived: \d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('should have correct styling classes', () => {
    render(
      <PassStatus 
        pass={null} 
        currentLocation={mockCurrentLocation} 
      />
    );

    expect(screen.getByTestId('card')).toHaveClass('w-full', 'max-w-md', 'mx-auto');
    expect(screen.getByTestId('card-title')).toHaveClass('text-center');
    expect(screen.getByTestId('card-content')).toHaveClass('text-center');
  });
}); 