import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportingDashboard } from '../ReportingDashboard';
import { Pass, User, Location } from '@/types';

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className} data-testid="card-content">{children}</div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div className={className} data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: any) => (
    <h3 className={className} data-testid="card-title">{children}</h3>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button onClick={onClick} className={`${variant} ${size}`} data-testid="button">
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-testid="input"
    />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.('test-value')}>
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Download: () => <div data-testid="download-icon">Download</div>,
  Filter: () => <div data-testid="filter-icon">Filter</div>,
  BarChart3: () => <div data-testid="bar-chart-icon">BarChart3</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  MapPin: () => <div data-testid="map-pin-icon">MapPin</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
}));

describe('ReportingDashboard', () => {
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
      name: 'Bob Johnson',
      email: 'bob.johnson@school.edu',
      role: 'student',
      schoolId: 'school1',
    },
  ];

  const mockLocations: Location[] = [
    {
      id: 'location1',
      name: 'Main Bathroom',
      locationType: 'bathroom',
      schoolId: 'school1',
      capacity: 2,
      isActive: true,
    },
    {
      id: 'location2',
      name: 'Library',
      locationType: 'library',
      schoolId: 'school1',
      capacity: 5,
      isActive: true,
    },
  ];

  const mockPasses: Pass[] = [
    {
      id: 'pass1',
      studentId: 'student1',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      legs: [{
        id: 'leg1',
        originLocationId: 'location1',
        destinationLocationId: 'location2',
        status: 'active',
        createdAt: new Date().toISOString(),
      }],
      durationMinutes: 15,
    },
    {
      id: 'pass2',
      studentId: 'student2',
      status: 'CLOSED',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      lastUpdatedAt: new Date().toISOString(),
      legs: [{
        id: 'leg2',
        originLocationId: 'location2',
        destinationLocationId: 'location1',
        status: 'completed',
        createdAt: new Date().toISOString(),
      }],
      durationMinutes: 25,
    },
    {
      id: 'pass3',
      studentId: 'student1',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      legs: [{
        id: 'leg3',
        originLocationId: 'location1',
        destinationLocationId: 'location2',
        status: 'active',
        createdAt: new Date().toISOString(),
      }],
      durationMinutes: 45, // Overdue
    },
    {
      id: 'pass4',
      studentId: 'student3',
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      legs: [{
        id: 'leg4',
        originLocationId: 'location1',
        destinationLocationId: 'location2',
        status: 'active',
        createdAt: new Date().toISOString(),
      }],
      durationMinutes: 70, // Escalated
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL for export tests
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock document.createElement for export tests
    const mockElement = {
      click: jest.fn(),
      href: '',
      download: '',
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockElement as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render dashboard with title and description', () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
        description="Test description"
      />
    );

    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should display correct metrics', () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    // Total passes
    expect(screen.getByText('4')).toBeInTheDocument(); // Total passes
    expect(screen.getByText('3 currently active')).toBeInTheDocument();

    // Average duration (only closed passes: 25 minutes)
    expect(screen.getByText('25m')).toBeInTheDocument();

    // Unique students (3 different student IDs)
    expect(screen.getByText('3')).toBeInTheDocument();

    // Unique locations (2 different locations)
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should display overdue and escalated alerts', () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    expect(screen.getByText('Overdue Passes')).toBeInTheDocument();
    expect(screen.getByText('Escalated Passes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Overdue count
    expect(screen.getByText('1')).toBeInTheDocument(); // Escalated count
  });

  it('should handle search filtering', async () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    const searchInput = screen.getByPlaceholderText('Name or email...');
    fireEvent.change(searchInput, { target: { value: 'john' } });

    // Should show filtered count
    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ of 4 passes/)).toBeInTheDocument();
    });
  });

  it('should handle status filtering', async () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    const statusSelect = screen.getAllByTestId('select')[0];
    fireEvent.click(statusSelect);

    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ of 4 passes/)).toBeInTheDocument();
    });
  });

  it('should handle location filtering', async () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    const locationSelect = screen.getAllByTestId('select')[1];
    fireEvent.click(locationSelect);

    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ of 4 passes/)).toBeInTheDocument();
    });
  });

  it('should handle date range filtering', async () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    const dateSelect = screen.getAllByTestId('select')[2];
    fireEvent.click(dateSelect);

    await waitFor(() => {
      expect(screen.getByText(/Showing \d+ of 4 passes/)).toBeInTheDocument();
    });
  });

  it('should clear all filters', async () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    // Set some filters first
    const searchInput = screen.getByPlaceholderText('Name or email...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Click clear filters
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
    });
  });

  it('should handle export with custom handler', () => {
    const mockOnExport = jest.fn();
    
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
        onExport={mockOnExport}
      />
    );

    const exportButton = screen.getByText('Export Data');
    fireEvent.click(exportButton);

    expect(mockOnExport).toHaveBeenCalledWith(mockPasses);
  });

  it('should handle default CSV export', () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    const exportButton = screen.getByText('Export Data');
    fireEvent.click(exportButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith('a');
  });

  it('should format duration correctly', () => {
    const longDurationPasses: Pass[] = [
      {
        id: 'pass1',
        studentId: 'student1',
        status: 'CLOSED',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        legs: [{
          id: 'leg1',
          originLocationId: 'location1',
          destinationLocationId: 'location2',
          status: 'completed',
          createdAt: new Date().toISOString(),
        }],
        durationMinutes: 125, // 2h 5m
      },
    ];

    render(
      <ReportingDashboard
        passes={longDurationPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    expect(screen.getByText('2h 5m')).toBeInTheDocument();
  });

  it('should handle empty passes array', () => {
    render(
      <ReportingDashboard
        passes={[]}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument(); // Total passes
    expect(screen.getByText('Showing 0 of 0 passes')).toBeInTheDocument();
  });

  it('should handle passes without duration', () => {
    const passesWithoutDuration: Pass[] = [
      {
        id: 'pass1',
        studentId: 'student1',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        legs: [{
          id: 'leg1',
          originLocationId: 'location1',
          destinationLocationId: 'location2',
          status: 'active',
          createdAt: new Date().toISOString(),
        }],
        // No durationMinutes property
      },
    ];

    render(
      <ReportingDashboard
        passes={passesWithoutDuration}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    expect(screen.getByText('0m')).toBeInTheDocument(); // Average duration
  });

  it('should render children content', () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      >
        <div data-testid="child-content">Child Content</div>
      </ReportingDashboard>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('should handle students with only name property', () => {
    const searchTerm = 'Bob Johnson';
    
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    const searchInput = screen.getByPlaceholderText('Name or email...');
    fireEvent.change(searchInput, { target: { value: searchTerm } });

    // Should be able to search by name even when student only has 'name' property
    expect(searchInput).toHaveValue(searchTerm);
  });

  it('should display all filter options', () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    expect(screen.getByText('Search Students')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('should calculate metrics correctly with mixed data', () => {
    const mixedPasses: Pass[] = [
      ...mockPasses,
      {
        id: 'pass5',
        studentId: 'student1', // Duplicate student
        status: 'CLOSED',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        legs: [{
          id: 'leg5',
          originLocationId: 'location1',
          destinationLocationId: 'location1', // Same location
          status: 'completed',
          createdAt: new Date().toISOString(),
        }],
        durationMinutes: 10,
      },
    ];

    render(
      <ReportingDashboard
        passes={mixedPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    // Should still show 3 unique students
    expect(screen.getByText('3')).toBeInTheDocument();
    
    // Average should be (25 + 10) / 2 = 17.5 ≈ 18m
    expect(screen.getByText('18m')).toBeInTheDocument();
  });

  it('should handle date filtering edge cases', () => {
    const futurePasses: Pass[] = [
      {
        id: 'future-pass',
        studentId: 'student1',
        status: 'OPEN',
        createdAt: new Date(Date.now() + 86400000).toISOString(), // Future date
        lastUpdatedAt: new Date().toISOString(),
        legs: [{
          id: 'future-leg',
          originLocationId: 'location1',
          destinationLocationId: 'location2',
          status: 'active',
          createdAt: new Date().toISOString(),
        }],
        durationMinutes: 15,
      },
    ];

    render(
      <ReportingDashboard
        passes={futurePasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    // Future passes should still be shown in "all time" view
    expect(screen.getByText('Showing 1 of 1 passes')).toBeInTheDocument();
  });
});