import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ParentPortal from '../ParentPortal';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
  CardDescription: ({ children, className }: any) => <div className={className} data-testid="card-description">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className} data-testid="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button onClick={onClick} className={`${variant} ${size}`} data-testid="button">
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className} data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => <div data-testid="tabs" data-default-value={defaultValue}>{children}</div>,
  TabsContent: ({ children, value }: any) => <div data-testid="tabs-content" data-value={value}>{children}</div>,
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button data-testid="tabs-trigger" data-value={value}>{children}</button>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
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
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor} data-testid="label">{children}</label>,
}));

describe('ParentPortal', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [] }) } as Response);
    render(<ParentPortal />);
    expect(screen.getByText('Loading student records...')).toBeInTheDocument();
  });

  it('should render portal with FERPA notice', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [] }) } as Response);
    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('Parent Portal')).toBeInTheDocument());
    expect(screen.getByText(/FERPA Rights Notice/)).toBeInTheDocument();
  });

  it('should close FERPA notice when X button is clicked', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [] }) } as Response);
    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('Parent Portal')).toBeInTheDocument());
    fireEvent.click(screen.getByText('×'));
    await waitFor(() => expect(screen.queryByText(/FERPA Rights Notice/)).not.toBeInTheDocument());
  });

  it('should display tabs navigation', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [] }) } as Response);
    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('Student Records')).toBeInTheDocument());
    expect(screen.getByText('Parent Relationships')).toBeInTheDocument();
    expect(screen.getByText('Directory Information')).toBeInTheDocument();
  });

  it('should display no records message when no student records available', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [] }) } as Response);
    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('No student records available.')).toBeInTheDocument());
  });

  const mockRelationshipJohn = {
    id: 'rel-1', parentId: 'parent-1', parentEmail: 'parent@example.com', studentId: 'student-1', studentName: 'John Doe', relationshipType: 'parent', verifiedAt: new Date(), active: true,
  };

  it('should display student records with passes', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [mockRelationshipJohn] }) } as Response);
    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('Hall Passes - John Doe')).toBeInTheDocument());
    expect(screen.getByText('Restroom')).toBeInTheDocument();
  });

  const mockRelationshipJane = {
    id: 'rel-2', parentId: 'parent-1', parentEmail: 'parent@example.com', studentId: 'student-2', studentName: 'Jane Doe', relationshipType: 'guardian', verifiedAt: new Date(), active: true,
  };

  it('should display passes for a student who has them', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [mockRelationshipJane] }) } as Response);
    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('Hall Passes - Jane Doe')).toBeInTheDocument());
    expect(screen.getByText('Restroom')).toBeInTheDocument();
  });

  it('should display parent relationships', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ relationships: [mockRelationshipJohn, mockRelationshipJane] }) } as Response);
    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('should handle directory opt-out changes', async () => {
    const mockRelationships = [mockRelationshipJohn];
    mockFetch.mockImplementation(async (url) => {
      if (url.toString().includes('/api/parent/relationships')) {
        return { ok: true, json: async () => ({ relationships: mockRelationships }) };
      }
      if (url.toString().includes('/api/parent/directory-info')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: false, status: 404 };
    });

    render(<ParentPortal />);
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    fireEvent.click(screen.getAllByTestId('switch')[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/parent/directory-info', expect.anything());
    });
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('API Error'));
    render(<ParentPortal />);
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error loading parent portal data:', expect.any(Error)));
  });
});