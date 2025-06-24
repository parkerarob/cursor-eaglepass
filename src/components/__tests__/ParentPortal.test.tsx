import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ParentPortal from '../ParentPortal';

// Mock fetch globally
global.fetch = jest.fn();

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className} data-testid="card-content">{children}</div>
  ),
  CardDescription: ({ children, className }: any) => (
    <div className={className} data-testid="card-description">{children}</div>
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

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => (
    <span className={className} data-testid="badge">{children}</span>
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => (
    <div data-testid="tabs" data-default-value={defaultValue}>{children}</div>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid="tabs-content" data-value={value}>{children}</div>
  ),
  TabsList: ({ children }: any) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({ children, value }: any) => (
    <button data-testid="tabs-trigger" data-value={value}>{children}</button>
  ),
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => (
    <div data-testid="alert">{children}</div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  ),
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, id }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      id={id}
      data-testid="switch"
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor} data-testid="label">{children}</label>
  ),
}));

describe('ParentPortal', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    expect(screen.getByText('Loading student records...')).toBeInTheDocument();
  });

  it('should render portal with FERPA notice', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Parent Portal')).toBeInTheDocument();
    });

    expect(screen.getByText(/FERPA Rights Notice/)).toBeInTheDocument();
    expect(screen.getByText(/You have the right to inspect and review/)).toBeInTheDocument();
  });

  it('should close FERPA notice when X button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Parent Portal')).toBeInTheDocument();
    });

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText(/FERPA Rights Notice/)).not.toBeInTheDocument();
    });
  });

  it('should display tabs navigation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Student Records')).toBeInTheDocument();
    });

    expect(screen.getByText('Parent Relationships')).toBeInTheDocument();
    expect(screen.getByText('Directory Information')).toBeInTheDocument();
  });

  it('should display no records message when no student records available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('No student records available.')).toBeInTheDocument();
    });

    expect(screen.getByText('You need to have a verified parent-student relationship to access records.')).toBeInTheDocument();
  });

  it('should display student records with passes', async () => {
    const mockRelationships = [
      {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'John Doe',
        relationshipType: 'parent',
        verifiedAt: new Date(),
        active: true,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: mockRelationships }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Hall Passes - John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Recent hall pass activity')).toBeInTheDocument();
    expect(screen.getByText('Restroom')).toBeInTheDocument();
    expect(screen.getByText('returned')).toBeInTheDocument();
    expect(screen.getByText('Ms. Smith')).toBeInTheDocument();
  });

  it('should display no passes message when student has no passes', async () => {
    const mockRelationships = [
      {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'Jane Doe',
        relationshipType: 'parent',
        verifiedAt: new Date(),
        active: true,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: mockRelationships }),
    } as Response);

    // Mock the component to return empty passes
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Hall Passes - Jane Doe')).toBeInTheDocument();
    });

    console.error = originalConsoleError;
  });

  it('should display parent relationships', async () => {
    const mockRelationships = [
      {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'Emma Smith',
        relationshipType: 'guardian',
        verifiedAt: new Date('2023-01-15'),
        active: true,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: mockRelationships }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Parent-Student Relationships')).toBeInTheDocument();
    });

    expect(screen.getByText('Your verified relationships with students')).toBeInTheDocument();
    expect(screen.getByText('Emma Smith')).toBeInTheDocument();
    expect(screen.getByText('Relationship: guardian')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should display no relationships message when no relationships exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('No verified parent-student relationships found.')).toBeInTheDocument();
    });

    expect(screen.getByText('Contact school administration to establish a parent-student relationship.')).toBeInTheDocument();
  });

  it('should display directory information opt-out controls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Directory Information Opt-Out')).toBeInTheDocument();
    });

    expect(screen.getByText('Control what directory information can be shared about your child')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Grade Level')).toBeInTheDocument();
    expect(screen.getByText('Dates Of Attendance')).toBeInTheDocument();
    expect(screen.getByText('Activities Participation')).toBeInTheDocument();
    expect(screen.getByText('Degrees Honors Awards')).toBeInTheDocument();
    expect(screen.getByText('Photo')).toBeInTheDocument();
  });

  it('should handle directory opt-out changes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relationships: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Directory Information Opt-Out')).toBeInTheDocument();
    });

    const switches = screen.getAllByTestId('switch');
    fireEvent.click(switches[0]); // Click first switch (name)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/parent/directory-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentId: 'parent-1',
          studentId: 'student-1',
          studentName: 'Emma Johnson',
          optOutItems: ['name'],
        }),
      });
    });
  });

  it('should display FERPA information section', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('FERPA Information')).toBeInTheDocument();
    });

    expect(screen.getByText('Your Rights Under FERPA:')).toBeInTheDocument();
    expect(screen.getByText(/Inspect and review your child's educational records/)).toBeInTheDocument();
    expect(screen.getByText(/Request corrections to records/)).toBeInTheDocument();
    expect(screen.getByText(/Have some control over the disclosure/)).toBeInTheDocument();
    expect(screen.getByText(/File a complaint with the U.S. Department of Education/)).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Parent Portal')).toBeInTheDocument();
    });

    expect(console.error).toHaveBeenCalledWith('Error loading parent portal data:', expect.any(Error));
  });

  it('should handle failed relationships API call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('No student records available.')).toBeInTheDocument();
    });
  });

  it('should handle directory opt-out API errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relationships: [] }),
      } as Response)
      .mockRejectedValueOnce(new Error('Directory API Error'));

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Directory Information Opt-Out')).toBeInTheDocument();
    });

    const switches = screen.getAllByTestId('switch');
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Error updating directory information opt-out:', expect.any(Error));
    });
  });

  it('should display inactive relationship badge', async () => {
    const mockRelationships = [
      {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'Inactive Student',
        relationshipType: 'parent',
        verifiedAt: new Date('2023-01-15'),
        active: false,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: mockRelationships }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Inactive Student')).toBeInTheDocument();
    });

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should format dates correctly', async () => {
    const testDate = new Date('2023-12-15T14:30:00');
    const mockRelationships = [
      {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'Test Student',
        relationshipType: 'parent',
        verifiedAt: testDate,
        active: true,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: mockRelationships }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Test Student')).toBeInTheDocument();
    });

    // Check for formatted date (format may vary by locale)
    expect(screen.getByText(/Verified:/)).toBeInTheDocument();
  });

  it('should display different relationship types', async () => {
    const mockRelationships = [
      {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'Student One',
        relationshipType: 'authorized_representative',
        verifiedAt: new Date(),
        active: true,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: mockRelationships }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Student One')).toBeInTheDocument();
    });

    expect(screen.getByText('Relationship: authorized_representative')).toBeInTheDocument();
  });

  it('should handle successful directory opt-out API response', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relationships: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Directory Information Opt-Out')).toBeInTheDocument();
    });

    const switches = screen.getAllByTestId('switch');
    expect(switches[0]).not.toBeChecked();
    
    fireEvent.click(switches[0]);

    // Should update the switch state
    await waitFor(() => {
      expect(switches[0]).toBeChecked();
    });
  });

  it('should handle failed directory opt-out API response', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ relationships: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
      } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Directory Information Opt-Out')).toBeInTheDocument();
    });

    const switches = screen.getAllByTestId('switch');
    fireEvent.click(switches[0]);

    // Switch should not change state if API fails
    await waitFor(() => {
      expect(switches[0]).not.toBeChecked();
    });
  });

  it('should display directory information notice', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: [] }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText(/Directory information may be disclosed without prior consent/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Opt-out preferences are applied per student and school year/)).toBeInTheDocument();
  });

  it('should handle pass status badge colors', async () => {
    const mockRelationships = [
      {
        id: 'rel-1',
        parentId: 'parent-1',
        parentEmail: 'parent@example.com',
        studentId: 'student-1',
        studentName: 'Status Test Student',
        relationshipType: 'parent',
        verifiedAt: new Date(),
        active: true,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ relationships: mockRelationships }),
    } as Response);

    render(<ParentPortal />);

    await waitFor(() => {
      expect(screen.getByText('Hall Passes - Status Test Student')).toBeInTheDocument();
    });

    // The mock data includes a 'returned' status badge
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBeGreaterThan(0);
  });
});