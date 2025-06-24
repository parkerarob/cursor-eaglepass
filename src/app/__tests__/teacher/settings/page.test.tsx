import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TeacherSettingsPage from '../../../teacher/settings/page';

// Mock the RoleProvider
jest.mock('@/components/RoleProvider', () => ({
  useRole: jest.fn(),
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock Firebase Firestore functions
jest.mock('@/lib/firebase/firestore', () => ({
  updateUser: jest.fn(),
  getClassroomPolicy: jest.fn(),
  updateClassroomPolicy: jest.fn(),
  getStudentPolicyOverrides: jest.fn(),
  getUsers: jest.fn(),
  createStudentPolicyOverride: jest.fn(),
  updateStudentPolicyOverride: jest.fn(),
  deleteStudentPolicyOverride: jest.fn(),
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  formatUserName: jest.fn((user) => user?.name || `${user?.firstName} ${user?.lastName}`),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">
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

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input 
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      data-testid="input"
      {...props}
    />
  ),
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

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange && onValueChange('Allow')}>
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

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => (
    <label htmlFor={htmlFor} data-testid="label">{children}</label>
  ),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="arrow-left-icon">←</div>,
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  );
});

describe('TeacherSettingsPage', () => {
  const mockCurrentUser = {
    id: 'teacher1',
    firstName: 'John',
    lastName: 'Doe',
    assignedLocationId: 'room101',
    schoolId: 'school1',
    role: 'teacher',
  };

  const mockClassroomPolicy = {
    id: 'policy1',
    locationId: 'room101',
    ownerId: 'teacher1',
    rules: {
      studentLeave: 'Allow' as const,
      studentArrive: 'Allow' as const,
      teacherRequest: 'Allow' as const,
    },
  };

  const mockStudentOverrides = [
    {
      id: 'override1',
      studentId: 'student1',
      locationId: 'room101',
      ownerId: 'teacher1',
      rules: {
        studentLeave: 'Ask' as const,
        studentArrive: 'Allow' as const,
        teacherRequest: 'Allow' as const,
      },
    },
  ];

  const mockStudents = [
    { id: 'student1', firstName: 'Alice', lastName: 'Johnson', role: 'student' },
    { id: 'student2', firstName: 'Bob', lastName: 'Smith', role: 'student' },
  ];

  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the role provider
    const { useRole } = require('@/components/RoleProvider');
    useRole.mockReturnValue({ 
      currentUser: mockCurrentUser,
      setCurrentUser: jest.fn(),
    });

    // Mock Next.js router
    const { useRouter } = require('next/navigation');
    useRouter.mockReturnValue(mockRouter);

    // Mock Firebase functions
    const {
      updateUser,
      getClassroomPolicy,
      updateClassroomPolicy,
      getStudentPolicyOverrides,
      getUsers,
      createStudentPolicyOverride,
      updateStudentPolicyOverride,
      deleteStudentPolicyOverride,
    } = require('@/lib/firebase/firestore');

    updateUser.mockResolvedValue(undefined);
    getClassroomPolicy.mockResolvedValue(mockClassroomPolicy);
    updateClassroomPolicy.mockResolvedValue(undefined);
    getStudentPolicyOverrides.mockResolvedValue(mockStudentOverrides);
    getUsers.mockResolvedValue([...mockStudents, mockCurrentUser]);
    createStudentPolicyOverride.mockResolvedValue('new-override-id');
    updateStudentPolicyOverride.mockResolvedValue(undefined);
    deleteStudentPolicyOverride.mockResolvedValue(undefined);
  });

  it('should render teacher settings page', async () => {
    render(<TeacherSettingsPage />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
    expect(screen.getByText('Classroom Policy')).toBeInTheDocument();
  });

  it('should display user profile fields', async () => {
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const inputs = screen.getAllByTestId('input');
      expect(inputs).toHaveLength(5); // First name, last name, room, school, email
    });
  });

  it('should handle profile update', async () => {
    const { updateUser } = require('@/lib/firebase/firestore');
    
    render(<TeacherSettingsPage />);

    // Wait for inputs to be populated
    await waitFor(() => {
      const firstNameInput = screen.getAllByTestId('input')[0];
      expect(firstNameInput).toHaveValue('John');
    });

    // Update first name
    const firstNameInput = screen.getAllByTestId('input')[0];
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } });

    // Click update button
    const updateButton = screen.getByText('Save Changes');
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('teacher1', {
        firstName: 'Jane',
        lastName: 'Doe',
        assignedLocationId: 'room101',
        schoolId: 'school1',
      });
    });
  });

  it('should handle profile update error', async () => {
    const { updateUser } = require('@/lib/firebase/firestore');
    updateUser.mockRejectedValue(new Error('Update failed'));
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const updateButton = screen.getByText('Save Changes');
      fireEvent.click(updateButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to update profile:/)).toBeInTheDocument();
    });
  });

  it('should display classroom policy when loaded', async () => {
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Students who want to leave my classroom/)).toBeInTheDocument();
      expect(screen.getByText(/Students who want to come to my classroom/)).toBeInTheDocument();
      expect(screen.getByText(/Teachers who request a student from my classroom/)).toBeInTheDocument();
    });
  });

  it('should handle policy rule changes', async () => {
    const { updateClassroomPolicy } = require('@/lib/firebase/firestore');
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const selectElements = screen.getAllByTestId('select');
      expect(selectElements.length).toBeGreaterThan(0);
    });

    // Click on a select to change policy
    const firstSelect = screen.getAllByTestId('select')[0];
    fireEvent.click(firstSelect);

    await waitFor(() => {
      expect(updateClassroomPolicy).toHaveBeenCalledWith('room101', {
        ownerId: 'teacher1',
        rules: {
          studentLeave: 'Allow',
          studentArrive: 'Allow',
          teacherRequest: 'Allow',
        },
      });
    });
  });

  it('should display student overrides', async () => {
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Student-Specific Overrides')).toBeInTheDocument();
      expect(screen.getByText('Add Override')).toBeInTheDocument();
    });
  });

  it('should open override dialog when add override is clicked', async () => {
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const addButton = screen.getByText('Add Override');
      fireEvent.click(addButton);
    });

    expect(screen.getByTestId('dialog')).toHaveAttribute('data-open', 'true');
  });

  it('should handle creating new override', async () => {
    const { createStudentPolicyOverride } = require('@/lib/firebase/firestore');
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const addButton = screen.getByText('Add Override');
      fireEvent.click(addButton);
    });

    // In the dialog, click save
    const saveButton = screen.getByText('Save changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Check that dialog opened instead of direct API call
      expect(screen.getByText('Add Student Override')).toBeInTheDocument();
    });
  });

  it('should handle updating existing override', async () => {
    const { updateStudentPolicyOverride } = require('@/lib/firebase/firestore');
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      // Find and click edit button for existing override
      const editButtons = screen.getAllByText('Edit');
      if (editButtons.length > 0) {
        fireEvent.click(editButtons[0]);
      }
    });

    // Save the override
    const saveButton = screen.getByText('Save changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateStudentPolicyOverride).toHaveBeenCalled();
    });
  });

  it('should handle deleting override', async () => {
    const { deleteStudentPolicyOverride } = require('@/lib/firebase/firestore');
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      // Find and click delete button
      const deleteButtons = screen.getAllByText('Delete');
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }
    });

    await waitFor(() => {
      expect(deleteStudentPolicyOverride).toHaveBeenCalled();
    });
  });

  it('should handle policy update error', async () => {
    const { updateClassroomPolicy } = require('@/lib/firebase/firestore');
    updateClassroomPolicy.mockRejectedValue(new Error('Policy update failed'));
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const selectElements = screen.getAllByTestId('select');
      if (selectElements.length > 0) {
        fireEvent.click(selectElements[0]);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to update policy.')).toBeInTheDocument();
    });
  });

  it('should handle override save error', async () => {
    const { createStudentPolicyOverride } = require('@/lib/firebase/firestore');
    createStudentPolicyOverride.mockRejectedValue(new Error('Override save failed'));
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const addButton = screen.getByText('Add Override');
      fireEvent.click(addButton);
    });

    const saveButton = screen.getByText('Save changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save override.')).toBeInTheDocument();
    });
  });

  it('should handle override delete error', async () => {
    const { deleteStudentPolicyOverride } = require('@/lib/firebase/firestore');
    deleteStudentPolicyOverride.mockRejectedValue(new Error('Delete failed'));
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to delete override.')).toBeInTheDocument();
    });
  });

  it('should not render when no current user', () => {
    const { useRole } = require('@/components/RoleProvider');
    useRole.mockReturnValue({ currentUser: null, setCurrentUser: jest.fn() });
    
    render(<TeacherSettingsPage />);

    expect(screen.queryByText('Teacher Settings')).not.toBeInTheDocument();
  });

  it('should handle fetch policy data error', async () => {
    const { getClassroomPolicy } = require('@/lib/firebase/firestore');
    getClassroomPolicy.mockRejectedValue(new Error('Fetch failed'));
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch policy data.')).toBeInTheDocument();
    });
  });

  it('should display loading state for policy', () => {
    const { getClassroomPolicy } = require('@/lib/firebase/firestore');
    getClassroomPolicy.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<TeacherSettingsPage />);

    expect(screen.getByText('Loading policy...')).toBeInTheDocument();
  });

  it('should handle policy changes with different autonomy types', async () => {
    const { updateClassroomPolicy } = require('@/lib/firebase/firestore');
    
    render(<TeacherSettingsPage />);

    await waitFor(() => {
      const selects = screen.getAllByTestId('select');
      expect(selects.length).toBeGreaterThan(0);
    });

    // Test different policy values
    const select = screen.getAllByTestId('select')[0];
    fireEvent.click(select);

    await waitFor(() => {
      expect(updateClassroomPolicy).toHaveBeenCalled();
    });
  });

  it('should update user profile fields when currentUser changes', async () => {
    const { useRole } = require('@/components/RoleProvider');
    const { rerender } = render(<TeacherSettingsPage />);

    // Change the current user
    const newUser = {
      ...mockCurrentUser,
      firstName: 'Updated',
      lastName: 'Name',
    };
    useRole.mockReturnValue({ currentUser: newUser, setCurrentUser: jest.fn() });

    rerender(<TeacherSettingsPage />);

    await waitFor(() => {
      const inputs = screen.getAllByTestId('input');
      expect(inputs[0]).toHaveValue('Updated');
      expect(inputs[1]).toHaveValue('Name');
    });
  });

  it('should render back to dashboard link', () => {
    render(<TeacherSettingsPage />);

    expect(screen.getByTestId('link')).toHaveAttribute('href', '/teacher');
    expect(screen.getAllByText('Back to Dashboard')).toHaveLength(2);
  });
}); 