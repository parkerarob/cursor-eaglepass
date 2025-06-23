import { EmergencyDisclosureManager } from '../emergencyDisclosureManager';
import { getUserById } from '../firebase/firestore';
import { FERPAAuditLogger } from '../ferpaAuditLogger';
import { monitoringService } from '../monitoringService';

// Mock dependencies
jest.mock('../firebase/firestore');
jest.mock('../ferpaAuditLogger');
jest.mock('../monitoringService');

const mockGetUserById = getUserById as jest.Mock;
const mockFERPAAuditLogger = FERPAAuditLogger as jest.Mocked<typeof FERPAAuditLogger>;
const mockMonitoringService = monitoringService as jest.Mocked<typeof monitoringService>;

describe('EmergencyDisclosureManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockGetUserById.mockResolvedValue({
      id: 'student-123',
      name: 'John Doe',
      email: 'john.doe@school.edu',
      role: 'student',
      emergencyContacts: [
        {
          name: 'Jane Doe',
          email: 'jane.doe@email.com',
          phone: '555-1234',
          relationship: 'parent',
          isPrimary: true
        }
      ]
    });
    
    mockFERPAAuditLogger.logEmergencyDisclosure.mockResolvedValue(undefined);
    mockMonitoringService.logWarning.mockImplementation(() => {});
  });

  describe('recordEmergencyDisclosure', () => {
    it('should record emergency disclosure successfully', async () => {
      const result = await EmergencyDisclosureManager.recordEmergencyDisclosure(
        ['student-123'],
        ['nurse', 'principal'],
        'Medical emergency',
        'health',
        'teacher-456',
        ['pass_records', 'location_data'],
        { severity: 'high' }
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        studentIds: ['student-123'],
        disclosedTo: ['nurse', 'principal'],
        disclosureReason: 'Medical emergency',
        emergencyType: 'health',
        disclosedBy: 'teacher-456',
        dataCategories: ['pass_records', 'location_data'],
        postEmergencyNotificationSent: false,
        schoolYear: expect.any(String),
        additionalDetails: { severity: 'high' }
      });

      expect(mockFERPAAuditLogger.logEmergencyDisclosure).toHaveBeenCalledWith(
        'teacher-456',
        ['student-123'],
        [],
        'health',
        'Medical emergency',
        ['nurse', 'principal']
      );

      expect(mockMonitoringService.logWarning).toHaveBeenCalledWith(
        'Emergency disclosure recorded',
        expect.objectContaining({
          emergencyType: 'health',
          studentCount: 1,
          disclosedTo: 'nurse, principal',
          reason: 'Medical emergency'
        })
      );
    });

    it('should handle errors during recording', async () => {
      mockFERPAAuditLogger.logEmergencyDisclosure.mockRejectedValue(new Error('FERPA logging failed'));

      await expect(EmergencyDisclosureManager.recordEmergencyDisclosure(
        ['student-123'],
        ['nurse'],
        'Medical emergency',
        'health',
        'teacher-456'
      )).rejects.toThrow('FERPA logging failed');
    });
  });

  describe('sendPostEmergencyNotifications', () => {
    it('should send notifications successfully', async () => {
      const disclosure = {
        id: 'emergency-123',
        studentIds: ['student-123'],
        disclosedTo: ['nurse'],
        disclosureReason: 'Medical emergency',
        emergencyType: 'health' as const,
        disclosedAt: new Date('2024-01-01T10:00:00Z'),
        disclosedBy: 'teacher-456',
        dataCategories: ['pass_records'],
        postEmergencyNotificationSent: false,
        schoolYear: '2024-2025',
        additionalDetails: {}
      };

      const result = await EmergencyDisclosureManager.sendPostEmergencyNotifications(disclosure);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        disclosureId: 'emergency-123',
        studentId: 'student-123',
        parentEmail: 'jane.doe@email.com',
        sentAt: expect.any(Date),
        deliveryStatus: 'sent',
        notificationContent: expect.stringContaining('Medical emergency')
      });
    });

    it('should handle students without emergency contacts', async () => {
      mockGetUserById.mockResolvedValue({
        id: 'student-456',
        name: 'Jane Smith',
        email: 'jane.smith@school.edu',
        role: 'student',
        emergencyContacts: []
      });

      const disclosure = {
        id: 'emergency-456',
        studentIds: ['student-456'],
        disclosedTo: ['nurse'],
        disclosureReason: 'Safety concern',
        emergencyType: 'safety' as const,
        disclosedAt: new Date('2024-01-01T10:00:00Z'),
        disclosedBy: 'teacher-789',
        dataCategories: ['pass_records'],
        postEmergencyNotificationSent: false,
        schoolYear: '2024-2025',
        additionalDetails: {}
      };

      const result = await EmergencyDisclosureManager.sendPostEmergencyNotifications(disclosure);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        disclosureId: 'emergency-456',
        studentId: 'student-456',
        parentEmail: 'NOT_AVAILABLE',
        deliveryStatus: 'failed',
        notificationContent: 'No emergency contacts on file'
      });
    });

    it('should handle students with contacts but no email', async () => {
      mockGetUserById.mockResolvedValue({
        id: 'student-789',
        name: 'Bob Wilson',
        email: 'bob.wilson@school.edu',
        role: 'student',
        emergencyContacts: [
          {
            name: 'Mary Wilson',
            email: '',
            phone: '555-5678',
            relationship: 'parent',
            isPrimary: true
          }
        ]
      });

      const disclosure = {
        id: 'emergency-789',
        studentIds: ['student-789'],
        disclosedTo: ['principal'],
        disclosureReason: 'Security incident',
        emergencyType: 'security' as const,
        disclosedAt: new Date('2024-01-01T10:00:00Z'),
        disclosedBy: 'teacher-123',
        dataCategories: ['pass_records'],
        postEmergencyNotificationSent: false,
        schoolYear: '2024-2025',
        additionalDetails: {}
      };

      const result = await EmergencyDisclosureManager.sendPostEmergencyNotifications(disclosure);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        disclosureId: 'emergency-789',
        studentId: 'student-789',
        parentEmail: 'NO_EMAIL_ON_CONTACT',
        deliveryStatus: 'failed',
        notificationContent: 'Emergency contact found but no email address'
      });
    });

    it('should handle errors during notification sending', async () => {
      mockGetUserById.mockRejectedValue(new Error('Database error'));

      const disclosure = {
        id: 'emergency-error',
        studentIds: ['student-error'],
        disclosedTo: ['nurse'],
        disclosureReason: 'Medical emergency',
        emergencyType: 'health' as const,
        disclosedAt: new Date('2024-01-01T10:00:00Z'),
        disclosedBy: 'teacher-456',
        dataCategories: ['pass_records'],
        postEmergencyNotificationSent: false,
        schoolYear: '2024-2025',
        additionalDetails: {}
      };

      const result = await EmergencyDisclosureManager.sendPostEmergencyNotifications(disclosure);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        disclosureId: 'emergency-error',
        studentId: 'student-error',
        parentEmail: 'ERROR',
        deliveryStatus: 'failed',
        notificationContent: 'Notification failed: Database error'
      });
    });
  });

  describe('processPendingNotifications', () => {
    it('should process pending notifications successfully', async () => {
      // Mock getPendingNotifications to return test data
      const mockDisclosure = {
        id: 'emergency-pending',
        studentIds: ['student-123'],
        disclosedTo: ['nurse'],
        disclosureReason: 'Medical emergency',
        emergencyType: 'health' as const,
        disclosedAt: new Date('2024-01-01T10:00:00Z'),
        disclosedBy: 'teacher-456',
        dataCategories: ['pass_records'],
        postEmergencyNotificationSent: false,
        schoolYear: '2024-2025',
        additionalDetails: {}
      };

      // Mock the static method
      const mockGetPendingNotifications = jest.spyOn(EmergencyDisclosureManager, 'getPendingNotifications')
        .mockResolvedValue([mockDisclosure]);
      
      const mockSendPostEmergencyNotifications = jest.spyOn(EmergencyDisclosureManager, 'sendPostEmergencyNotifications')
        .mockResolvedValue([]);

      await EmergencyDisclosureManager.processPendingNotifications();

      expect(mockGetPendingNotifications).toHaveBeenCalled();
      expect(mockSendPostEmergencyNotifications).toHaveBeenCalledWith(mockDisclosure);

      mockGetPendingNotifications.mockRestore();
      mockSendPostEmergencyNotifications.mockRestore();
    });

    it('should handle no pending notifications', async () => {
      const mockGetPendingNotifications = jest.spyOn(EmergencyDisclosureManager, 'getPendingNotifications')
        .mockResolvedValue([]);
      
      const mockSendPostEmergencyNotifications = jest.spyOn(EmergencyDisclosureManager, 'sendPostEmergencyNotifications')
        .mockResolvedValue([]);

      await EmergencyDisclosureManager.processPendingNotifications();

      expect(mockGetPendingNotifications).toHaveBeenCalled();
      expect(mockSendPostEmergencyNotifications).not.toHaveBeenCalled();

      mockGetPendingNotifications.mockRestore();
      mockSendPostEmergencyNotifications.mockRestore();
    });
  });
}); 