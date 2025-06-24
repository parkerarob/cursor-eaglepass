import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StallSitterCard } from '../StallSitterCard';

// Mock dependencies
jest.mock('@/lib/firebase/firestore', () => ({
  getLongestPassesByLocationType: jest.fn(),
}));

jest.mock('@/lib/utils', () => ({
  formatUserName: jest.fn((user: any) => user.name || `${user.firstName} ${user.lastName}`),
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => (
    <a href={href} data-testid="link">{children}</a>
  );
});

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button 
      onClick={onClick} 
      className={`${variant} ${size} ${className}`}
      data-testid="button"
      data-variant={variant}
    >
      {children}
    </button>
  ),
}));

const mockGetLongestPassesByLocationType = require('@/lib/firebase/firestore').getLongestPassesByLocationType;

describe('StallSitterCard', () => {
  const mockData = [
    {
      pass: {
        id: 'pass-1',
        createdAt: new Date('2024-01-15T10:00:00Z').toISOString(),
        studentName: 'John Doe',
        destination: 'Bathroom',
        status: 'returned'
      },
      student: {
        id: 'student-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      },
      duration: 15.5
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetLongestPassesByLocationType.mockResolvedValue(mockData);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render card with title and description', async () => {
    render(<StallSitterCard />);

    expect(screen.getByTestId('card-title')).toHaveTextContent('Stall Sitters');
    expect(screen.getByTestId('card-description')).toHaveTextContent('Students with the longest bathroom visits.');
  });

  it('should render timeframe buttons', async () => {
    render(<StallSitterCard />);

    expect(screen.getByRole('button', { name: 'day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'all' })).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    mockGetLongestPassesByLocationType.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<StallSitterCard />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display data when loaded', async () => {
    render(<StallSitterCard />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('16 min')).toBeInTheDocument(); // Rounded 15.5
  });
});
