import React from 'react';
import { render, screen } from '@testing-library/react';

// Test 1: Absolutely minimal component
const MinimalComponent = ({ title }: { title: string }) => <div>{title}</div>;

// Test 2: Import our rewritten component
import ReportingDashboard from '../ReportingDashboard';
import type { Pass, User, Location } from '@/types';

// Mock data for testing
const mockStudents: User[] = [
  {
    id: 'student1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@school.edu',
    role: 'student',
  },
];

const mockLocations: Location[] = [
  {
    id: 'location1',
    name: 'Main Bathroom',
    locationType: 'bathroom',
  },
];

const mockPasses: Pass[] = [
  {
    id: 'pass1',
    studentId: 'student1',
    status: 'OPEN',
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    legs: [{
      id: 'leg1',
      legNumber: 1,
      originLocationId: 'location1',
      destinationLocationId: 'location1',
      state: 'OUT',
      timestamp: new Date(),
    }],
    durationMinutes: 15,
  },
];

describe('JSDOM Diagnostic Tests', () => {
  it('renders minimal component', () => {
    render(<MinimalComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  // This test will help us isolate if the issue is in the import itself
  it('can import ReportingDashboard without crash', () => {
    expect(ReportingDashboard).toBeDefined();
  });

  // SUCCESS! The rewrite fixed the JSDOM issue
  it('renders ReportingDashboard successfully (JSDOM issue fixed!)', () => {
    render(
      <ReportingDashboard
        passes={mockPasses}
        students={mockStudents}
        locations={mockLocations}
        title="Test Dashboard"
      />
    );

    // Verify it actually rendered the content
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Passes')).toBeInTheDocument();
    expect(screen.getByTestId('metric-total')).toBeInTheDocument();
    expect(screen.getByText('Average Duration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export pass data as csv/i })).toBeInTheDocument();
  });
}); 