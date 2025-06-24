import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatePassForm } from '../CreatePassForm';
import { Location } from '@/types';

// Mock the firestore functions
jest.mock('@/lib/firebase/firestore', () => ({
  getAvailableDestinations: jest.fn(),
  getClassroomDestinationsWithTeachers: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      className={className}
      data-testid="button"
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">{children}</div>
  ),
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => (
    <h3 className={className} data-testid="card-title">{children}</h3>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.('classroom1')}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

describe('CreatePassForm', () => {
  const mockOnCreatePass = jest.fn();
  const { getAvailableDestinations, getClassroomDestinationsWithTeachers } = require('@/lib/firebase/firestore');

  const mockDestinations: Location[] = [
    {
      id: 'bathroom1',
      name: 'Main Bathroom',
      locationType: 'bathroom',
      schoolId: 'school1',
      capacity: 2,
      isActive: true,
    },
    {
      id: 'nurse1',
      name: 'Nurse Office',
      locationType: 'nurse',
      schoolId: 'school1',
      capacity: 1,
      isActive: true,
    },
    {
      id: 'library1',
      name: 'Main Library',
      locationType: 'library',
      schoolId: 'school1',
      capacity: 5,
      isActive: true,
    },
  ];

  const mockClassrooms: Location[] = [
    {
      id: 'classroom1',
      name: 'Room 101',
      locationType: 'classroom',
      schoolId: 'school1',
      capacity: 30,
      isActive: true,
      teacherName: 'Ms. Smith',
    },
    {
      id: 'classroom2',
      name: 'Room 102',
      locationType: 'classroom',
      schoolId: 'school1',
      capacity: 25,
      isActive: true,
      teacherName: 'Mr. Johnson',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    getAvailableDestinations.mockResolvedValue(mockDestinations);
    getClassroomDestinationsWithTeachers.mockResolvedValue(mockClassrooms);
  });

  it('should render form with default heading', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    expect(screen.getByTestId('card-title')).toHaveTextContent('Where are you going?');
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should render form with custom heading', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} heading="Custom Heading" />);

    expect(screen.getByTestId('card-title')).toHaveTextContent('Custom Heading');
  });

  it('should load and display available destinations', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.getByText('Visit Another Location')).toBeInTheDocument();
      expect(screen.getByText('Main Bathroom')).toBeInTheDocument();
      expect(screen.getByText('Nurse Office')).toBeInTheDocument();
      expect(screen.getByText('Main Library')).toBeInTheDocument();
    });

    expect(getAvailableDestinations).toHaveBeenCalled();
    expect(getClassroomDestinationsWithTeachers).toHaveBeenCalled();
  });

  it('should display classroom destinations with teacher names', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.getByText('Visit Another Classroom')).toBeInTheDocument();
      expect(screen.getByText('Ms. Smith | Room 101')).toBeInTheDocument();
      expect(screen.getByText('Mr. Johnson | Room 102')).toBeInTheDocument();
    });
  });

  it('should show correct icons for different location types', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.getByText('🚻')).toBeInTheDocument(); // bathroom
      expect(screen.getByText('🏥')).toBeInTheDocument(); // nurse
      expect(screen.getByText('📚')).toBeInTheDocument(); // library
    });
  });

  it('should handle destination button clicks', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      const bathroomButton = screen.getByText('Main Bathroom').closest('button');
      expect(bathroomButton).toBeInTheDocument();
    });

    const bathroomButton = screen.getByText('Main Bathroom').closest('button');
    fireEvent.click(bathroomButton!);

    expect(mockOnCreatePass).toHaveBeenCalledWith({
      destinationLocationId: 'bathroom1',
    });
  });

  it('should handle classroom selection and form submission', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.getByTestId('select')).toBeInTheDocument();
    });

    // Select a classroom
    const selectElement = screen.getByTestId('select');
    fireEvent.click(selectElement);

    await waitFor(() => {
      expect(screen.getByTestId('button')).toBeInTheDocument();
    });

    // Submit the form
    const submitButton = screen.getByText('Create Pass');
    fireEvent.click(submitButton);

    expect(mockOnCreatePass).toHaveBeenCalledWith({
      destinationLocationId: 'classroom1',
    });
  });

  it('should show loading state', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} isLoading={true} />);

    await waitFor(() => {
      expect(screen.getByText('Creating Pass...')).toBeInTheDocument();
    });

    const buttons = screen.getAllByTestId('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('should exclude specified location ID', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} excludeLocationId="bathroom1" />);

    await waitFor(() => {
      expect(getAvailableDestinations).toHaveBeenCalled();
      expect(getClassroomDestinationsWithTeachers).toHaveBeenCalled();
    });

    // Should not show the excluded bathroom
    await waitFor(() => {
      expect(screen.queryByText('Main Bathroom')).not.toBeInTheDocument();
      expect(screen.getByText('Nurse Office')).toBeInTheDocument();
      expect(screen.getByText('Main Library')).toBeInTheDocument();
    });
  });

  it('should exclude classroom from dropdown when specified', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} excludeLocationId="classroom1" />);

    await waitFor(() => {
      expect(screen.getByText('Visit Another Classroom')).toBeInTheDocument();
      expect(screen.queryByText('Ms. Smith | Room 101')).not.toBeInTheDocument();
      expect(screen.getByText('Mr. Johnson | Room 102')).toBeInTheDocument();
    });
  });

  it('should show no destinations message when empty', async () => {
    getAvailableDestinations.mockResolvedValue([]);
    getClassroomDestinationsWithTeachers.mockResolvedValue([]);

    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.getByText('No available destinations found.')).toBeInTheDocument();
      expect(screen.getByText(/This may be due to current restrictions/)).toBeInTheDocument();
    });
  });

  it('should handle form submission with selected destination', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      const selectElement = screen.getByTestId('select');
      fireEvent.click(selectElement);
    });

    // Create a form element and submit it
    const form = screen.getByTestId('card-content').querySelector('form');
    expect(form).toBeInTheDocument();

    if (form) {
      fireEvent.submit(form);
      expect(mockOnCreatePass).toHaveBeenCalledWith({
        destinationLocationId: 'classroom1',
      });
    }
  });

  it('should disable submit button when no destination selected', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      const submitButton = screen.getByText('Create Pass');
      expect(submitButton).toBeDisabled();
    });
  });

  it('should reset form after submission', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      const selectElement = screen.getByTestId('select');
      fireEvent.click(selectElement);
    });

    const form = screen.getByTestId('card-content').querySelector('form');
    if (form) {
      fireEvent.submit(form);
    }

    // After submission, the select should be reset
    await waitFor(() => {
      const selectElement = screen.getByTestId('select');
      expect(selectElement).toHaveAttribute('data-value', '');
    });
  });

  it('should handle different location types with correct icons', async () => {
    const diverseLocations: Location[] = [
      {
        id: 'office1',
        name: 'Main Office',
        locationType: 'office',
        schoolId: 'school1',
        capacity: 3,
        isActive: true,
      },
      {
        id: 'cafeteria1',
        name: 'Cafeteria',
        locationType: 'cafeteria',
        schoolId: 'school1',
        capacity: 100,
        isActive: true,
      },
      {
        id: 'unknown1',
        name: 'Unknown Location',
        locationType: 'other' as any,
        schoolId: 'school1',
        capacity: 1,
        isActive: true,
      },
    ];

    getAvailableDestinations.mockResolvedValue(diverseLocations);

    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.getByText('🏢')).toBeInTheDocument(); // office
      expect(screen.getByText('🍽️')).toBeInTheDocument(); // cafeteria
      expect(screen.getByText('📍')).toBeInTheDocument(); // default/unknown
    });
  });

  it('should handle API errors gracefully', async () => {
    getAvailableDestinations.mockRejectedValue(new Error('API Error'));
    getClassroomDestinationsWithTeachers.mockRejectedValue(new Error('API Error'));

    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    // Should still render the form structure
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('card-title')).toBeInTheDocument();
  });

  it('should not render classroom dropdown when no classrooms available', async () => {
    getClassroomDestinationsWithTeachers.mockResolvedValue([]);

    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.queryByText('Visit Another Classroom')).not.toBeInTheDocument();
      expect(screen.queryByTestId('select')).not.toBeInTheDocument();
    });
  });

  it('should not render destination buttons when no destinations available', async () => {
    getAvailableDestinations.mockResolvedValue([]);

    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.queryByText('Visit Another Location')).not.toBeInTheDocument();
    });
  });

  it('should handle classroom selection change', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      const selectElement = screen.getByTestId('select');
      expect(selectElement).toBeInTheDocument();
    });

    const selectElement = screen.getByTestId('select');
    fireEvent.click(selectElement);

    await waitFor(() => {
      expect(selectElement).toHaveAttribute('data-value', 'classroom1');
    });
  });

  it('should show submit button only when classrooms are available', async () => {
    render(<CreatePassForm onCreatePass={mockOnCreatePass} />);

    await waitFor(() => {
      expect(screen.getByText('Create Pass')).toBeInTheDocument();
    });

    // Test when no classrooms are available
    getClassroomDestinationsWithTeachers.mockResolvedValue([]);
    
    const { rerender } = render(<CreatePassForm onCreatePass={mockOnCreatePass} />);
    
    await waitFor(() => {
      expect(screen.queryByText('Create Pass')).not.toBeInTheDocument();
    });
  });
}); 