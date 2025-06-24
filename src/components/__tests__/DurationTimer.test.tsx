import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { DurationTimer } from '../DurationTimer';
import { Pass } from '@/types';

// Mock the notification service
jest.mock('@/lib/notificationService', () => ({
  NotificationService: {
    calculateDuration: jest.fn(),
    getNotificationStatus: jest.fn(),
  },
}));

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <div className={`badge ${variant} ${className}`} data-testid="badge">
      {children}
    </div>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className} data-testid="card-content">{children}</div>
  ),
}));

describe('DurationTimer', () => {
  const { NotificationService } = require('@/lib/notificationService');
  
  const mockPass: Pass = {
    id: 'pass1',
    studentId: 'student1',
    studentName: 'John Doe',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    destinationLocationId: 'bathroom1',
    currentLocationId: 'classroom1',
    schoolId: 'school1',
    teacherId: 'teacher1',
    passType: 'bathroom',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Default mocks
    NotificationService.calculateDuration.mockReturnValue(15);
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 15,
      notificationLevel: 'none',
      isOverdue: false,
      shouldEscalate: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render duration timer with basic information', () => {
    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getByText('15m')).toBeInTheDocument();
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should format duration correctly for minutes', () => {
    NotificationService.calculateDuration.mockReturnValue(45);
    
    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('should format duration correctly for hours and minutes', () => {
    NotificationService.calculateDuration.mockReturnValue(125); // 2h 5m
    
    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('2h 5m')).toBeInTheDocument();
  });

  it('should format duration correctly for exact hours', () => {
    NotificationService.calculateDuration.mockReturnValue(120); // 2h 0m
    
    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('2h 0m')).toBeInTheDocument();
  });

  it('should display overdue badge when pass is overdue', () => {
    NotificationService.calculateDuration.mockReturnValue(60);
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 60,
      notificationLevel: 'high',
      isOverdue: true,
      shouldEscalate: false,
    });

    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('OVERDUE (1h 0m)')).toBeInTheDocument();
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('destructive');
  });

  it('should display escalated badge when pass should escalate', () => {
    NotificationService.calculateDuration.mockReturnValue(30);
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 30,
      notificationLevel: 'medium',
      isOverdue: false,
      shouldEscalate: true,
    });

    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('ESCALATED (30m)')).toBeInTheDocument();
    const badges = screen.getAllByTestId('badge');
    const escalatedBadge = badges.find(badge => badge.textContent?.includes('ESCALATED'));
    expect(escalatedBadge).toHaveClass('secondary');
  });

  it('should display notification level badge when notifications are active', () => {
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 20,
      notificationLevel: 'medium',
      isOverdue: false,
      shouldEscalate: false,
    });

    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('MEDIUM NOTIFIED')).toBeInTheDocument();
    const badges = screen.getAllByTestId('badge');
    const notificationBadge = badges.find(badge => badge.textContent?.includes('NOTIFIED'));
    expect(notificationBadge).toHaveClass('outline');
  });

  it('should display overdue message when pass is overdue', () => {
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 60,
      notificationLevel: 'high',
      isOverdue: true,
      shouldEscalate: false,
    });

    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('This pass has exceeded the maximum duration and requires immediate attention.')).toBeInTheDocument();
  });

  it('should display escalation message when pass should escalate', () => {
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 30,
      notificationLevel: 'medium',
      isOverdue: false,
      shouldEscalate: true,
    });

    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('This pass has been active for an extended period and may need attention.')).toBeInTheDocument();
  });

  it('should not display notification badge when level is none', () => {
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 10,
      notificationLevel: 'none',
      isOverdue: false,
      shouldEscalate: false,
    });

    render(<DurationTimer pass={mockPass} />);

    expect(screen.queryByText(/NOTIFIED/)).not.toBeInTheDocument();
  });

  it('should update duration every minute', async () => {
    let callCount = 0;
    NotificationService.calculateDuration.mockImplementation(() => {
      callCount++;
      return callCount * 5; // 5, 10, 15, etc.
    });

    render(<DurationTimer pass={mockPass} />);

    // Initial call
    expect(screen.getByText('5m')).toBeInTheDocument();

    // Advance time by 1 minute
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(screen.getByText('10m')).toBeInTheDocument();
    });

    // Advance time by another minute
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(screen.getByText('15m')).toBeInTheDocument();
    });

    expect(NotificationService.calculateDuration).toHaveBeenCalledTimes(3);
  });

  it('should cleanup interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    const { unmount } = render(<DurationTimer pass={mockPass} />);
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('should handle different notification levels', () => {
    const notificationLevels = ['low', 'medium', 'high', 'critical'];
    
    notificationLevels.forEach(level => {
      NotificationService.getNotificationStatus.mockReturnValue({
        durationMinutes: 20,
        notificationLevel: level,
        isOverdue: false,
        shouldEscalate: false,
      });

      const { rerender } = render(<DurationTimer pass={mockPass} />);
      
      expect(screen.getByText(`${level.toUpperCase()} NOTIFIED`)).toBeInTheDocument();
      
      rerender(<div></div>); // Clear for next iteration
    });
  });

  it('should apply custom className', () => {
    render(<DurationTimer pass={mockPass} className="custom-class" />);

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-class');
  });

  it('should handle pass updates correctly', () => {
    const { rerender } = render(<DurationTimer pass={mockPass} />);

    // Update pass
    const updatedPass = { ...mockPass, id: 'pass2' };
    
    NotificationService.calculateDuration.mockReturnValue(25);
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 25,
      notificationLevel: 'low',
      isOverdue: false,
      shouldEscalate: false,
    });

    rerender(<DurationTimer pass={updatedPass} />);

    expect(screen.getByText('25m')).toBeInTheDocument();
    expect(screen.getByText('LOW NOTIFIED')).toBeInTheDocument();
  });

  it('should handle zero duration', () => {
    NotificationService.calculateDuration.mockReturnValue(0);
    
    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('0m')).toBeInTheDocument();
  });

  it('should handle large durations', () => {
    NotificationService.calculateDuration.mockReturnValue(1500); // 25h 0m
    
    render(<DurationTimer pass={mockPass} />);

    expect(screen.getByText('25h 0m')).toBeInTheDocument();
  });

  it('should handle both overdue and escalated states', () => {
    NotificationService.getNotificationStatus.mockReturnValue({
      durationMinutes: 90,
      notificationLevel: 'critical',
      isOverdue: true,
      shouldEscalate: true,
    });

    render(<DurationTimer pass={mockPass} />);

    // Should prioritize overdue over escalated
    expect(screen.getByText('OVERDUE (1h 30m)')).toBeInTheDocument();
    expect(screen.queryByText(/ESCALATED/)).not.toBeInTheDocument();
    expect(screen.getByText('CRITICAL NOTIFIED')).toBeInTheDocument();
  });

  it('should call notification service with correct pass', () => {
    render(<DurationTimer pass={mockPass} />);

    expect(NotificationService.calculateDuration).toHaveBeenCalledWith(mockPass);
    expect(NotificationService.getNotificationStatus).toHaveBeenCalledWith(mockPass);
  });

  it('should update notification status when duration changes', async () => {
    let durationCallCount = 0;
    let statusCallCount = 0;

    NotificationService.calculateDuration.mockImplementation(() => {
      durationCallCount++;
      return durationCallCount * 10;
    });

    NotificationService.getNotificationStatus.mockImplementation(() => {
      statusCallCount++;
      return {
        durationMinutes: statusCallCount * 10,
        notificationLevel: statusCallCount > 2 ? 'medium' : 'none',
        isOverdue: statusCallCount > 3,
        shouldEscalate: statusCallCount > 2,
      };
    });

    render(<DurationTimer pass={mockPass} />);

    // Initial state
    expect(screen.getByText('10m')).toBeInTheDocument();

    // Advance time
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(screen.getByText('20m')).toBeInTheDocument();
    });

    // Advance time again to trigger notification
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(screen.getByText('30m')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM NOTIFIED')).toBeInTheDocument();
    });
  });
}); 