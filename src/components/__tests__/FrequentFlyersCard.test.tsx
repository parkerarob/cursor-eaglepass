import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FrequentFlyersCard } from '../FrequentFlyersCard';
import { User } from '@/types';

// Mock firestore functions
jest.mock('@/lib/firebase/firestore', () => ({
  getPassCountsByStudent: jest.fn(),
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  formatUserName: jest.fn((user: User) => `${user.firstName} ${user.lastName}`),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href} data-testid="link">{children}</a>;
  };
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
    >
      {children}
    </button>
  ),
}));

describe('FrequentFlyersCard', () => {
  const { getPassCountsByStudent } = require('@/lib/firebase/firestore');
  
  const mockStudents: User[] = [
    {
      id: 'student1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@school.edu',
      role: 'student',
      schoolId: 'school1',
    },
    {
      id: 'student2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@school.edu',
      role: 'student',
      schoolId: 'school1',
    },
    {
      id: 'student3',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@school.edu',
      role: 'student',
      schoolId: 'school1',
    },
  ];

  const mockFrequentFlyersData = [
    { student: mockStudents[0], passCount: 15 },
    { student: mockStudents[1], passCount: 12 },
    { student: mockStudents[2], passCount: 8 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getPassCountsByStudent.mockResolvedValue(mockFrequentFlyersData);
  });

  it('should render card with title and description', async () => {
    render(<FrequentFlyersCard title="Test Frequent Flyers" />);

    expect(screen.getByTestId('card-title')).toHaveTextContent('Test Frequent Flyers');
    expect(screen.getByTestId('card-description')).toHaveTextContent('Top students across the school.');
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should show location-specific description when locationId provided', async () => {
    render(<FrequentFlyersCard title="Test Title" locationId="room101" />);

    expect(screen.getByTestId('card-description')).toHaveTextContent('Top students from your classes.');
  });

  it('should display loading state initially', () => {
    render(<FrequentFlyersCard title="Test Title" />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display student data after loading', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane.smith@school.edu')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    expect(getPassCountsByStudent).toHaveBeenCalledWith(undefined, 'all');
  });

  it('should display all timeframe buttons', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('day')).toBeInTheDocument();
      expect(screen.getByText('week')).toBeInTheDocument();
      expect(screen.getByText('month')).toBeInTheDocument();
      expect(screen.getByText('all')).toBeInTheDocument();
    });
  });

  it('should handle timeframe changes', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click on 'week' button
    const weekButton = screen.getByText('week');
    fireEvent.click(weekButton);

    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledWith(undefined, 'week');
    });
  });

  it('should handle day timeframe', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      const dayButton = screen.getByText('day');
      fireEvent.click(dayButton);
    });

    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledWith(undefined, 'day');
    });
  });

  it('should handle month timeframe', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      const monthButton = screen.getByText('month');
      fireEvent.click(monthButton);
    });

    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledWith(undefined, 'month');
    });
  });

  it('should pass locationId to API call', async () => {
    render(<FrequentFlyersCard title="Test Title" locationId="room101" />);

    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledWith('room101', 'all');
    });
  });

  it('should limit displayed results', async () => {
    const manyStudents = Array.from({ length: 10 }, (_, i) => ({
      student: {
        id: `student${i}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        email: `student${i}@school.edu`,
        role: 'student' as const,
        schoolId: 'school1',
      },
      passCount: 10 - i,
    }));

    getPassCountsByStudent.mockResolvedValue(manyStudents);

    render(<FrequentFlyersCard title="Test Title" limit={3} />);

    await waitFor(() => {
      expect(screen.getByText('Student0 Test')).toBeInTheDocument();
      expect(screen.getByText('Student1 Test')).toBeInTheDocument();
      expect(screen.getByText('Student2 Test')).toBeInTheDocument();
      expect(screen.queryByText('Student3 Test')).not.toBeInTheDocument();
    });
  });

  it('should show no data message when no students found', async () => {
    getPassCountsByStudent.mockResolvedValue([]);

    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('No student pass data found for the selected timeframe.')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getPassCountsByStudent.mockRejectedValue(new Error('API Error'));

    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('No student pass data found for the selected timeframe.')).toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching frequent flyers data:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should create correct links to student reports', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      const links = screen.getAllByTestId('link');
      expect(links[0]).toHaveAttribute('href', '/admin/reports/student/John Doe');
      expect(links[1]).toHaveAttribute('href', '/admin/reports/student/Jane Smith');
    });
  });

  it('should display student emails', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('john.doe@school.edu')).toBeInTheDocument();
      expect(screen.getByText('jane.smith@school.edu')).toBeInTheDocument();
      expect(screen.getByText('bob.johnson@school.edu')).toBeInTheDocument();
    });
  });

  it('should display pass counts', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  it('should use default limit of 5', async () => {
    const manyStudents = Array.from({ length: 10 }, (_, i) => ({
      student: {
        id: `student${i}`,
        firstName: `Student${i}`,
        lastName: 'Test',
        email: `student${i}@school.edu`,
        role: 'student' as const,
        schoolId: 'school1',
      },
      passCount: 10 - i,
    }));

    getPassCountsByStudent.mockResolvedValue(manyStudents);

    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('Student0 Test')).toBeInTheDocument();
      expect(screen.getByText('Student4 Test')).toBeInTheDocument();
      expect(screen.queryByText('Student5 Test')).not.toBeInTheDocument();
    });
  });

  it('should highlight active timeframe button', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      const buttons = screen.getAllByTestId('button');
      const allButton = buttons.find(btn => btn.textContent === 'all');
      expect(allButton).toHaveClass('default');
    });

    // Click week button
    const weekButton = screen.getByText('week');
    fireEvent.click(weekButton);

    await waitFor(() => {
      const buttons = screen.getAllByTestId('button');
      const weekButtonElement = buttons.find(btn => btn.textContent === 'week');
      expect(weekButtonElement).toHaveClass('default');
    });
  });

  it('should handle students with missing names gracefully', async () => {
    const studentWithMissingData = {
      student: {
        id: 'student-no-name',
        firstName: '',
        lastName: '',
        email: 'noname@school.edu',
        role: 'student' as const,
        schoolId: 'school1',
      },
      passCount: 5,
    };

    getPassCountsByStudent.mockResolvedValue([studentWithMissingData]);

    render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(screen.getByText('noname@school.edu')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('should refresh data when timeframe changes', async () => {
    render(<FrequentFlyersCard title="Test Title" />);

    // Initial load
    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledTimes(1);
    });

    // Change timeframe
    const dayButton = screen.getByText('day');
    fireEvent.click(dayButton);

    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledTimes(2);
      expect(getPassCountsByStudent).toHaveBeenLastCalledWith(undefined, 'day');
    });
  });

  it('should refresh data when locationId changes', async () => {
    const { rerender } = render(<FrequentFlyersCard title="Test Title" />);

    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledTimes(1);
    });

    // Change locationId
    rerender(<FrequentFlyersCard title="Test Title" locationId="room101" />);

    await waitFor(() => {
      expect(getPassCountsByStudent).toHaveBeenCalledTimes(2);
      expect(getPassCountsByStudent).toHaveBeenLastCalledWith('room101', 'all');
    });
  });
}); 