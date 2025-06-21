import { NotificationService } from '../notificationService';
import { Pass } from '@/types';

describe('NotificationService', () => {
  const mockPass: Pass = {
    id: 'test-pass-1',
    studentId: 'student-1',
    status: 'OPEN',
    createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    lastUpdatedAt: new Date(),
    legs: [
      {
        legNumber: 1,
        originLocationId: 'classroom-1',
        destinationLocationId: 'bathroom-1',
        state: 'IN',
        timestamp: new Date()
      }
    ]
  };

  beforeEach(() => {
    // Reset notification config to defaults
    NotificationService.updateConfig({
      studentNotificationMinutes: 10,
      adminEscalationMinutes: 20,
      notificationCooldownMinutes: 5
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration correctly', () => {
      const now = new Date();
      const pass: Pass = {
        ...mockPass,
        createdAt: new Date(now.getTime() - 30 * 60 * 1000) // 30 minutes ago
      };

      const duration = NotificationService.calculateDuration(pass);
      expect(duration).toBe(30);
    });

    it('should handle Date objects and timestamps', () => {
      const now = new Date();
      const pass: Pass = {
        ...mockPass,
        createdAt: now
      };

      const duration = NotificationService.calculateDuration(pass);
      expect(duration).toBe(0); // Should be 0 or very close to 0
    });
  });

  describe('shouldSendNotification', () => {
    it('should not send notification for new passes', () => {
      const newPass: Pass = {
        ...mockPass,
        createdAt: new Date(),
        notificationLevel: 'none'
      };

      const result = NotificationService.shouldSendNotification(newPass);
      expect(result.success).toBe(true);
      expect(result.notificationSent).toBe(false);
    });

    it('should send teacher notification at 10 minutes', () => {
      const tenMinutePass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        notificationLevel: 'none'
      };

      const result = NotificationService.shouldSendNotification(tenMinutePass);
      expect(result.success).toBe(true);
      expect(result.notificationSent).toBe(true);
      expect(result.notificationLevel).toBe('teacher');
    });

    it('should send admin notification at 20 minutes', () => {
      const twentyMinutePass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        notificationLevel: 'none'
      };

      const result = NotificationService.shouldSendNotification(twentyMinutePass);
      expect(result.success).toBe(true);
      expect(result.notificationSent).toBe(true);
      expect(result.notificationLevel).toBe('admin');
    });

    it('should not send duplicate notifications within cooldown period', () => {
      const pass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        notificationLevel: 'teacher',
        lastNotificationAt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
      };

      const result = NotificationService.shouldSendNotification(pass);
      expect(result.success).toBe(true);
      expect(result.notificationSent).toBe(false);
    });

    it('should escalate from teacher to admin notification', () => {
      const pass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
        notificationLevel: 'teacher',
        lastNotificationAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago (outside cooldown)
      };

      const result = NotificationService.shouldSendNotification(pass);
      expect(result.success).toBe(true);
      expect(result.notificationSent).toBe(true);
      expect(result.notificationLevel).toBe('admin');
    });
  });

  describe('getNotificationStatus', () => {
    it('should return correct status for normal duration', () => {
      const pass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        notificationLevel: 'none'
      };

      const status = NotificationService.getNotificationStatus(pass);
      expect(status.durationMinutes).toBe(5);
      expect(status.notificationLevel).toBe('none');
      expect(status.isOverdue).toBe(false);
      expect(status.shouldEscalate).toBe(false);
    });

    it('should return correct status for escalated duration', () => {
      const pass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        notificationLevel: 'teacher'
      };

      const status = NotificationService.getNotificationStatus(pass);
      expect(status.durationMinutes).toBe(15);
      expect(status.notificationLevel).toBe('teacher');
      expect(status.isOverdue).toBe(false);
      expect(status.shouldEscalate).toBe(true);
    });

    it('should return correct status for overdue duration', () => {
      const pass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
        notificationLevel: 'admin'
      };

      const status = NotificationService.getNotificationStatus(pass);
      expect(status.durationMinutes).toBe(25);
      expect(status.notificationLevel).toBe('admin');
      expect(status.isOverdue).toBe(true);
      expect(status.shouldEscalate).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update notification configuration', () => {
      NotificationService.updateConfig({
        studentNotificationMinutes: 5,
        adminEscalationMinutes: 15
      });

      const pass: Pass = {
        ...mockPass,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        notificationLevel: 'none'
      };

      const result = NotificationService.shouldSendNotification(pass);
      expect(result.success).toBe(true);
      expect(result.notificationSent).toBe(true);
      expect(result.notificationLevel).toBe('teacher'); // Should be teacher at 10 minutes with new config
    });
  });
}); 