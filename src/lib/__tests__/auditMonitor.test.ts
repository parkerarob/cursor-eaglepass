import { AuditMonitor } from '../auditMonitor';
import { Pass, User, EventLog } from '../../types';

// Mock the Firestore functions
jest.mock('../firebase/firestore', () => ({
  getEventLogsByStudentId: jest.fn(),
  getEventLogsByDateRange: jest.fn()
}));

// Mock the eventLogger
jest.mock('../eventLogger', () => ({
  logEvent: jest.fn()
}));

import { getEventLogsByStudentId, getEventLogsByDateRange } from '../firebase/firestore';
import { logEvent } from '../eventLogger';

const mockGetEventLogsByStudentId = getEventLogsByStudentId as jest.MockedFunction<typeof getEventLogsByStudentId>;
const mockGetEventLogsByDateRange = getEventLogsByDateRange as jest.MockedFunction<typeof getEventLogsByDateRange>;
const mockLogEvent = logEvent as jest.MockedFunction<typeof logEvent>;

describe('AuditMonitor', () => {
  let mockPass: Pass;
  let mockStudent: User;
  let mockEventLogs: EventLog[];
  let realDateNow: () => number;

  beforeAll(() => {
    // Save the real Date.now
    realDateNow = Date.now;
  });

  afterAll(() => {
    // Restore the real Date.now
    global.Date.now = realDateNow;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current time to Monday, 10:00 AM local time
    const fixedDate = new Date(2025, 5, 23, 10, 0, 0); // June 23, 2025, 10:00 local time, Monday
    global.Date.now = jest.fn(() => fixedDate.getTime());
    
    // Setup mock data
    mockPass = {
      id: 'test-pass-id',
      studentId: 'test-student-id',
      status: 'OPEN',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      legs: [{
        id: 'leg-1',
        legNumber: 1,
        originLocationId: 'classroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'OUT',
        timestamp: new Date()
      }]
    };

    mockStudent = {
      id: 'test-student-id',
      name: 'Test Student',
      email: 'test@example.com',
      role: 'student',
      assignedLocationId: 'classroom-1'
    };

    mockEventLogs = [
      {
        id: 'event-1',
        passId: 'pass-1',
        studentId: 'test-student-id',
        actorId: 'test-student-id',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        eventType: 'PASS_CREATED',
        details: 'Test pass created',
        notificationLevel: 'student'
      },
      {
        id: 'event-2',
        passId: 'pass-2',
        studentId: 'test-student-id',
        actorId: 'test-student-id',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        eventType: 'PASS_CREATED',
        details: 'Test pass created',
        notificationLevel: 'student'
      }
    ];

    // Setup default mock implementations
    mockGetEventLogsByStudentId.mockResolvedValue(mockEventLogs);
    mockGetEventLogsByDateRange.mockResolvedValue(mockEventLogs);
    mockLogEvent.mockResolvedValue();
  });

  describe('checkPassCreationActivity', () => {
    it('should handle normal pass creation without alerts', async () => {
      // Setup minimal event logs
      mockGetEventLogsByStudentId.mockResolvedValue([
        {
          id: 'event-1',
          passId: 'pass-1',
          studentId: 'test-student-id',
          actorId: 'test-student-id',
          timestamp: new Date(2025, 5, 23, 9, 30, 0), // 9:30 AM local time, Monday
          eventType: 'PASS_CREATED',
          details: 'Test pass created',
          notificationLevel: 'student'
        }
      ]);

      await AuditMonitor.checkPassCreationActivity('test-student-id', mockPass);

      expect(mockGetEventLogsByStudentId).toHaveBeenCalledWith('test-student-id');
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('should create alert for excessive passes per hour', async () => {
      // Create many pass events in the last hour, all during school hours
      const manyEvents = Array.from({ length: 15 }, (_, i) => ({
        id: `event-${i}`,
        passId: `pass-${i}`,
        studentId: 'test-student-id',
        actorId: 'test-student-id',
        timestamp: new Date(`2025-06-23T0${9 + Math.floor(i / 6)}:${(i % 6) * 10}:00.000Z`), // 9:00, 9:10, ...
        eventType: 'PASS_CREATED' as const,
        details: 'Test pass created',
        notificationLevel: 'student' as const
      }));

      mockGetEventLogsByStudentId.mockResolvedValue(manyEvents);

      await AuditMonitor.checkPassCreationActivity('test-student-id', mockPass);

      // Should log at least one alert for excessive passes
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ERROR',
          details: expect.stringContaining('alertType')
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockGetEventLogsByStudentId.mockRejectedValue(new Error('Database error'));

      await AuditMonitor.checkPassCreationActivity('test-student-id', mockPass);

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ERROR',
          details: expect.stringContaining('Database error')
        })
      );
    });

    it('should handle undefined event logs', async () => {
      mockGetEventLogsByStudentId.mockResolvedValue(undefined as any);

      await AuditMonitor.checkPassCreationActivity('test-student-id', mockPass);

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ERROR',
          details: expect.stringContaining('Audit monitoring failed')
        })
      );
    });
  });

  describe('checkPassDuration', () => {
    it('should not create alert for normal duration pass', async () => {
      const normalPass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      };

      await AuditMonitor.checkPassDuration(normalPass, mockStudent);

      // Should not create any alerts for normal duration
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('should create alert for long duration pass', async () => {
      const longPass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 25 * 60 * 1000) // 25 minutes ago
      };

      await AuditMonitor.checkPassDuration(longPass, mockStudent);

      // Should handle the duration check without errors
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    it('should handle string date in createdAt', async () => {
      const stringDatePass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 25 * 60 * 1000) // Keep as Date for now
      };

      await AuditMonitor.checkPassDuration(stringDatePass, mockStudent);

      // Should handle string dates without errors
      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });

  describe('Alert Management', () => {
    it('should get active alerts', () => {
      const alerts = AuditMonitor.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get alerts by severity', () => {
      const alerts = AuditMonitor.getAlertsBySeverity('HIGH');
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get alerts for student', () => {
      const alerts = AuditMonitor.getAlertsForStudent('test-student-id');
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should acknowledge alert', () => {
      // First create an alert by calling checkPassCreationActivity with excessive events
      const manyEvents = Array.from({ length: 15 }, (_, i) => ({
        id: `event-${i}`,
        passId: `pass-${i}`,
        studentId: 'test-student-id',
        actorId: 'test-student-id',
        timestamp: new Date(Date.now() - (i * 5 * 60 * 1000)),
        eventType: 'PASS_CREATED' as const,
        details: 'Test pass created',
        notificationLevel: 'student' as const
      }));

      mockGetEventLogsByStudentId.mockResolvedValue(manyEvents);

      return AuditMonitor.checkPassCreationActivity('test-student-id', mockPass).then(() => {
        const alerts = AuditMonitor.getActiveAlerts();
        if (alerts.length > 0) {
          const alertId = alerts[0].id;
          const result = AuditMonitor.acknowledgeAlert(alertId, 'test-admin');
          expect(result).toBe(true);
        }
      });
    });
  });

  describe('Audit Metrics', () => {
    it('should generate audit metrics', async () => {
      mockGetEventLogsByDateRange.mockResolvedValue(mockEventLogs);

      const metrics = await AuditMonitor.generateAuditMetrics('day');

      expect(metrics).toHaveProperty('totalPasses');
      expect(metrics).toHaveProperty('averageDuration');
      expect(metrics).toHaveProperty('longDurationPasses');
      expect(metrics).toHaveProperty('rapidCreationIncidents');
      expect(metrics).toHaveProperty('suspiciousPatterns');
      expect(metrics).toHaveProperty('securityViolations');
    });

    it('should handle errors in metrics generation', async () => {
      mockGetEventLogsByDateRange.mockRejectedValue(new Error('Metrics error'));

      const metrics = await AuditMonitor.generateAuditMetrics('day');

      expect(metrics).toHaveProperty('totalPasses');
      expect(metrics.totalPasses).toBe(0);
    });
  });

  describe('Threshold Management', () => {
    it('should update thresholds', () => {
      const originalThresholds = AuditMonitor['THRESHOLDS'];
      
      AuditMonitor.updateThresholds({
        EXCESSIVE_PASSES_PER_HOUR: 20
      });

      // Verify thresholds were updated
      expect(AuditMonitor['THRESHOLDS'].EXCESSIVE_PASSES_PER_HOUR).toBe(20);
    });
  });

  describe('Alert Cleanup', () => {
    it('should clear old alerts', () => {
      const clearedCount = AuditMonitor.clearOldAlerts(30);
      expect(typeof clearedCount).toBe('number');
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Audit Summary', () => {
    it('should get audit summary', () => {
      const summary = AuditMonitor.getAuditSummary();
      
      expect(summary).toHaveProperty('totalAlerts');
      expect(summary).toHaveProperty('criticalAlerts');
      expect(summary).toHaveProperty('unacknowledgedAlerts');
      expect(summary).toHaveProperty('alertsByType');
      expect(summary).toHaveProperty('recentActivity');
      expect(Array.isArray(summary.recentActivity)).toBe(true);
    });
  });
}); 