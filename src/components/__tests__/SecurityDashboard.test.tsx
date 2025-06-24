import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock the AuditMonitor - must be hoisted
jest.mock('@/lib/auditMonitor', () => ({
  AuditMonitor: {
    getActiveAlerts: jest.fn(),
    generateAuditMetrics: jest.fn(),
    getAuditSummary: jest.fn(),
    acknowledgeAlert: jest.fn(),
  },
}));

import { SecurityDashboard } from '../SecurityDashboard';
import { AuditMonitor } from '@/lib/auditMonitor';

const mockAuditMonitor = AuditMonitor as jest.Mocked<typeof AuditMonitor>;

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

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={`${variant} ${className}`} data-testid="badge">{children}</span>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button onClick={onClick} className={`${variant} ${size} ${className}`} data-testid="button">
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className }: any) => (
    <div className={className} data-testid="alert">{children}</div>
  ),
  AlertDescription: ({ children, className }: any) => (
    <div className={className} data-testid="alert-description">{children}</div>
  ),
  AlertTitle: ({ children, className }: any) => (
    <h4 className={className} data-testid="alert-title">{children}</h4>
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-triangle-icon">AlertTriangle</div>,
  Shield: () => <div data-testid="shield-icon">Shield</div>,
  Bell: () => <div data-testid="bell-icon">Bell</div>,
  Activity: () => <div data-testid="activity-icon">Activity</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
}));

describe('SecurityDashboard', () => {
  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    role: 'admin',
  };

  const mockAlerts = [
    {
      id: 'alert-1',
      type: 'EXCESSIVE_PASSES',
      severity: 'HIGH',
      description: 'Student has created multiple passes in short time',
      studentId: 'student-1',
      timestamp: new Date('2023-12-15T14:30:00'),
      details: { count: 5 },
    },
    {
      id: 'alert-2',
      type: 'LONG_DURATION',
      severity: 'MEDIUM',
      description: 'Pass duration exceeds normal limits',
      studentId: 'student-2',
      timestamp: new Date('2023-12-15T15:00:00'),
      details: { duration: 45 },
    },
  ];

  const mockMetrics = {
    totalPasses: 150,
    longDurationPasses: 5,
    rapidCreationIncidents: 3,
    suspiciousPatterns: 2,
    securityViolations: 1,
    averageDuration: 12,
  };

  const mockAuditSummary = {
    unacknowledgedAlerts: 3,
    criticalAlerts: 1,
    alertsByType: {
      EXCESSIVE_PASSES: 2,
      LONG_DURATION: 1,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue([]);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue({});
    mockAuditMonitor.getAuditSummary.mockReturnValue({});

    render(<SecurityDashboard currentUser={mockUser} />);

    expect(screen.getByText('Loading security data...')).toBeInTheDocument();
  });

  it('should render security dashboard with data', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
    });

    // Check security metrics cards
    expect(screen.getByText('3')).toBeInTheDocument(); // Unacknowledged alerts
    expect(screen.getByText('1')).toBeInTheDocument(); // Critical alerts
    expect(screen.getByText('150')).toBeInTheDocument(); // Total passes
    expect(screen.getByText('1')).toBeInTheDocument(); // Security events
  });

  it('should display security alerts correctly', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Active Security Alerts')).toBeInTheDocument();
    });

    expect(screen.getByText('2 alerts')).toBeInTheDocument();
    expect(screen.getByText('Student has created multiple passes in short time')).toBeInTheDocument();
    expect(screen.getByText('Pass duration exceeds normal limits')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('should display "All Clear" when no alerts', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue([]);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue({ ...mockAuditSummary, unacknowledgedAlerts: 0 });

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('All Clear')).toBeInTheDocument();
    });

    expect(screen.getByText('No active security alerts')).toBeInTheDocument();
    expect(screen.getByText('0 alerts')).toBeInTheDocument();
  });

  it('should handle alert acknowledgment', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);
    mockAuditMonitor.acknowledgeAlert.mockReturnValue(true);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Active Security Alerts')).toBeInTheDocument();
    });

    const acknowledgeButtons = screen.getAllByText('Acknowledge');
    fireEvent.click(acknowledgeButtons[0]);

    expect(mockAuditMonitor.acknowledgeAlert).toHaveBeenCalledWith('alert-1', 'user-1');
  });

  it('should not acknowledge alert when no current user', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={null} />);

    await waitFor(() => {
      expect(screen.getByText('Active Security Alerts')).toBeInTheDocument();
    });

    const acknowledgeButtons = screen.getAllByText('Acknowledge');
    fireEvent.click(acknowledgeButtons[0]);

    expect(mockAuditMonitor.acknowledgeAlert).not.toHaveBeenCalled();
  });

  it('should display metrics tab correctly', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Security Metrics (Last 24 Hours)')).toBeInTheDocument();
    });

    expect(screen.getByText('Pass Activity')).toBeInTheDocument();
    expect(screen.getByText('Security Events')).toBeInTheDocument();
    expect(screen.getByText('Total Passes Created:')).toBeInTheDocument();
    expect(screen.getByText('Long Duration Alerts:')).toBeInTheDocument();
    expect(screen.getByText('Rapid Creation Incidents:')).toBeInTheDocument();
    expect(screen.getByText('Suspicious Patterns:')).toBeInTheDocument();
    expect(screen.getByText('Security Violations:')).toBeInTheDocument();
    expect(screen.getByText('Average Duration:')).toBeInTheDocument();
  });

  it('should display notifications tab correctly', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Notification System Status')).toBeInTheDocument();
    });

    expect(screen.getByText('Notification System Active')).toBeInTheDocument();
    expect(screen.getByText('Active Channels:')).toBeInTheDocument();
    expect(screen.getByText('📧 Email')).toBeInTheDocument();
    expect(screen.getByText('📱 SMS')).toBeInTheDocument();
    expect(screen.getByText('🔔 Push')).toBeInTheDocument();
    expect(screen.getByText('📊 Dashboard')).toBeInTheDocument();
  });

  it('should handle refresh button click', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Should call the audit methods again
    expect(mockAuditMonitor.getActiveAlerts).toHaveBeenCalledTimes(2);
    expect(mockAuditMonitor.generateAuditMetrics).toHaveBeenCalledTimes(2);
    expect(mockAuditMonitor.getAuditSummary).toHaveBeenCalledTimes(2);
  });

  it('should auto-refresh every 30 seconds', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    // Initial load
    expect(mockAuditMonitor.getActiveAlerts).toHaveBeenCalledTimes(1);

    // Advance time by 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(mockAuditMonitor.getActiveAlerts).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle different alert severities and types', async () => {
    const diverseAlerts = [
      {
        id: 'alert-1',
        type: 'SECURITY_VIOLATION',
        severity: 'CRITICAL',
        description: 'Critical security violation detected',
        studentId: 'student-1',
        timestamp: new Date(),
      },
      {
        id: 'alert-2',
        type: 'UNUSUAL_PATTERN',
        severity: 'LOW',
        description: 'Unusual pattern detected',
        studentId: 'student-2',
        timestamp: new Date(),
      },
      {
        id: 'alert-3',
        type: 'RAPID_CREATION',
        severity: 'HIGH',
        description: 'Rapid pass creation detected',
        studentId: 'student-3',
        timestamp: new Date(),
      },
    ];

    mockAuditMonitor.getActiveAlerts.mockReturnValue(diverseAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Active Security Alerts')).toBeInTheDocument();
    });

    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('should handle missing metrics gracefully', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue([]);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(null);
    mockAuditMonitor.getAuditSummary.mockReturnValue(null);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Security Monitoring')).toBeInTheDocument();
    });

    // Should show 0 for all metrics
    expect(screen.getAllByText('0')).toHaveLength(4);
  });

  it('should handle API errors gracefully', async () => {
    mockAuditMonitor.getActiveAlerts.mockImplementation(() => {
      throw new Error('API Error');
    });

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to load security data:', expect.any(Error));
    });
  });

  it('should display correct alert icons', async () => {
    const alertsWithDifferentTypes = [
      { ...mockAlerts[0], type: 'EXCESSIVE_PASSES' },
      { ...mockAlerts[1], type: 'RAPID_CREATION' },
      { ...mockAlerts[0], id: 'alert-3', type: 'LONG_DURATION' },
      { ...mockAlerts[0], id: 'alert-4', type: 'UNUSUAL_PATTERN' },
      { ...mockAlerts[0], id: 'alert-5', type: 'SECURITY_VIOLATION' },
      { ...mockAlerts[0], id: 'alert-6', type: 'UNKNOWN_TYPE' },
    ];

    mockAuditMonitor.getActiveAlerts.mockReturnValue(alertsWithDifferentTypes);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Active Security Alerts')).toBeInTheDocument();
    });

    // Check that different icons are rendered
    expect(screen.getByTestId('users-icon')).toBeInTheDocument();
    expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    expect(screen.getByTestId('shield-icon')).toBeInTheDocument();
  });

  it('should clean up interval on unmount', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    mockAuditMonitor.getActiveAlerts.mockReturnValue([]);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    const { unmount } = render(<SecurityDashboard currentUser={mockUser} />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should display alert details correctly', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Student ID: student-1')).toBeInTheDocument();
    });

    expect(screen.getByText(/Time:/)).toBeInTheDocument();
    expect(screen.getByText(/Type: EXCESSIVE PASSES/)).toBeInTheDocument();
  });

  it('should handle failed alert acknowledgment', async () => {
    mockAuditMonitor.getActiveAlerts.mockReturnValue(mockAlerts);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);
    mockAuditMonitor.acknowledgeAlert.mockReturnValue(false);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText('Active Security Alerts')).toBeInTheDocument();
    });

    const acknowledgeButtons = screen.getAllByText('Acknowledge');
    fireEvent.click(acknowledgeButtons[0]);

    expect(mockAuditMonitor.acknowledgeAlert).toHaveBeenCalledWith('alert-1', 'user-1');
    // Should not reload data if acknowledgment failed
    expect(mockAuditMonitor.getActiveAlerts).toHaveBeenCalledTimes(1);
  });

  it('should display formatted alert timestamps', async () => {
    const testDate = new Date('2023-12-15T14:30:00');
    const alertsWithTimestamp = [
      {
        ...mockAlerts[0],
        timestamp: testDate,
      },
    ];

    mockAuditMonitor.getActiveAlerts.mockReturnValue(alertsWithTimestamp);
    mockAuditMonitor.generateAuditMetrics.mockResolvedValue(mockMetrics);
    mockAuditMonitor.getAuditSummary.mockReturnValue(mockAuditSummary);

    render(<SecurityDashboard currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText(/Time:/)).toBeInTheDocument();
    });
  });
});