import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeacherGroupsPage from '../../../teacher/groups/page';

// Mock the RoleProvider
jest.mock('@/components/RoleProvider', () => ({
  useRole: jest.fn(),
}));

// Mock Firebase Firestore functions
jest.mock('@/lib/firebase/firestore', () => ({
  getGroupsByOwner: jest.fn(),
  getAllStudents: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button onClick={onClick} data-testid="button" data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open} onClick={() => onOpenChange && onOpenChange(false)}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: any) => <div data-testid="dialog-description">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, id, ...props }: any) => (
    <input 
      id={id}
      value={value}
      onChange={onChange}
      data-testid="input"
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor} data-testid="label">{children}</label>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange && onValueChange('Positive')}>
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

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
}));

jest.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div data-testid="command">{children}</div>,
  CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
  CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
  CommandInput: ({ children }: any) => <input data-testid="command-input" />,
  CommandItem: ({ children, onSelect }: any) => (
    <div data-testid="command-item" onClick={() => onSelect && onSelect()}>
      {children}
    </div>
  ),
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
}));

jest.mock('@/lib/utils', () => ({
  cn: jest.fn((...classes) => classes.filter(Boolean).join(' ')),
  formatUserName: jest.fn((user) => user?.name || `${user?.firstName} ${user?.lastName}`),
}));

jest.mock('lucide-react', () => ({
  Check: () => <div data-testid="check-icon">✓</div>,
  ChevronsUpDown: () => <div data-testid="chevrons-up-down-icon">↕</div>,
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  );
});

describe('TeacherGroupsPage', () => {
  const mockCurrentUser = { id: 'teacher1', name: 'Test Teacher' };
  const mockGroups = [
    {
      id: 'group1',
      name: 'Math Class',
      groupType: 'Positive' as const,
      ownerId: 'teacher1',
      assignedStudents: ['student1', 'student2'],
      description: 'Advanced math students',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    },
    {
      id: 'group2',
      name: 'Detention',
      groupType: 'Negative' as const,
      ownerId: 'teacher1',
      assignedStudents: ['student3'],
      description: 'Students with restrictions',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    },
  ];

  const mockStudents = [
    { id: 'student1', name: 'Alice Johnson', role: 'STUDENT' },
    { id: 'student2', name: 'Bob Smith', role: 'STUDENT' },
    { id: 'student3', name: 'Charlie Brown', role: 'STUDENT' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the role provider
    const { useRole } = require('@/components/RoleProvider');
    useRole.mockReturnValue({ currentUser: mockCurrentUser });

    // Mock Firebase functions
    const { getGroupsByOwner, getAllStudents, createGroup, updateGroup, deleteGroup } = require('@/lib/firebase/firestore');
    getGroupsByOwner.mockResolvedValue(mockGroups);
    getAllStudents.mockResolvedValue(mockStudents);
    createGroup.mockResolvedValue({ id: 'new-group' });
    updateGroup.mockResolvedValue(undefined);
    deleteGroup.mockResolvedValue(undefined);

    // Mock window.confirm
    Object.defineProperty(window, 'confirm', {
      value: jest.fn(() => true),
      writable: true,
    });
  });

  it('should render groups page with title', async () => {
    render(<TeacherGroupsPage />);

    expect(screen.getByText('My Groups')).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    render(<TeacherGroupsPage />);

    expect(screen.getByText('Loading groups...')).toBeInTheDocument();
  });

  it('should display groups after loading', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Math Class')).toBeInTheDocument();
      expect(screen.getByText('Detention')).toBeInTheDocument();
    });

    expect(screen.getByText('2 student(s)')).toBeInTheDocument();
    expect(screen.getByText('1 student(s)')).toBeInTheDocument();
  });

  it('should display group types correctly', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      expect(screen.getByText('(Positive)')).toBeInTheDocument();
      expect(screen.getByText('(Negative)')).toBeInTheDocument();
    });
  });

  it('should show create new group button', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Create New Group')).toBeInTheDocument();
    });
  });

  it('should open dialog when create new group is clicked', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const createButton = screen.getByText('Create New Group');
      fireEvent.click(createButton);
    });

    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
    expect(screen.getByText('Create Group')).toBeInTheDocument();
  });

  it('should open dialog when edit group is clicked', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
    });

    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
    expect(screen.getByText('Edit Group')).toBeInTheDocument();
  });

  it('should handle group creation', async () => {
    const { createGroup } = require('@/lib/firebase/firestore');
    
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const createButton = screen.getByText('Create New Group');
      fireEvent.click(createButton);
    });

    // Fill in group name
    const nameInput = screen.getByDisplayValue('') || screen.getByTestId('input');
    fireEvent.change(nameInput, { target: { value: 'New Group' } });

    // Mock save action
    const saveButton = screen.getByText('Save Group');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalled();
    });
  });

  it('should handle group deletion with confirmation', async () => {
    const { deleteGroup } = require('@/lib/firebase/firestore');
    
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
    });

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this group?');
    expect(deleteGroup).toHaveBeenCalledWith('group1');
  });

  it('should handle group deletion cancellation', async () => {
    const { deleteGroup } = require('@/lib/firebase/firestore');
    
    // Mock confirm to return false
    window.confirm = jest.fn(() => false);
    
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteGroup).not.toHaveBeenCalled();
  });

  it('should handle error when fetching groups', async () => {
    const { getGroupsByOwner } = require('@/lib/firebase/firestore');
    getGroupsByOwner.mockRejectedValue(new Error('Network error'));
    
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch groups.')).toBeInTheDocument();
    });
  });

  it('should handle error when creating group', async () => {
    const { createGroup } = require('@/lib/firebase/firestore');
    createGroup.mockRejectedValue(new Error('Creation failed'));
    
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const createButton = screen.getByText('Create New Group');
      fireEvent.click(createButton);
    });

    // Try to save (will fail)
    const saveButton = screen.getByText('Save Group');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save group.')).toBeInTheDocument();
    });
  });

  it('should handle error when deleting group', async () => {
    const { deleteGroup } = require('@/lib/firebase/firestore');
    deleteGroup.mockRejectedValue(new Error('Deletion failed'));
    
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to delete group.')).toBeInTheDocument();
    });
  });

  it('should not render when no current user', () => {
    const { useRole } = require('@/components/RoleProvider');
    useRole.mockReturnValue({ currentUser: null });
    
    render(<TeacherGroupsPage />);

    expect(screen.queryByText('My Groups')).not.toBeInTheDocument();
  });

  it('should validate required fields before saving', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const createButton = screen.getByText('Create New Group');
      fireEvent.click(createButton);
    });

    // Try to save without filling required fields
    const saveButton = screen.getByText('Save Group');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Group name and type are required.')).toBeInTheDocument();
    });
  });

  it('should display dialog with correct content for creating group', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const createButton = screen.getByText('Create New Group');
      fireEvent.click(createButton);
    });

    expect(screen.getByText('Create Group')).toBeInTheDocument();
    expect(screen.getByText('Manage your student group. Add or remove members and set the group type.')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('should display dialog with correct content for editing group', async () => {
    render(<TeacherGroupsPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
    });

    expect(screen.getByText('Edit Group')).toBeInTheDocument();
    expect(screen.getByText('Manage your student group. Add or remove members and set the group type.')).toBeInTheDocument();
  });
}); 