// Eagle Pass data model types - Simple Foundation

export type UserRole = 'student' | 'teacher' | 'admin' | 'dev';

export interface EmergencyContact {
  name: string;
  relationship: string;
  email?: string;
  phone?: string;  
  isPrimary?: boolean;
}

export interface User {
  id: string;
  name?: string; // Full name, will be deprecated
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  // For students: their assigned classroom/location
  // For teachers: their assigned classroom/location
  assignedLocationId?: string;
  // Emergency contacts for notification system
  emergencyContacts?: EmergencyContact[];
  // For future: restrictions, groups, etc.
}

export interface Location {
  id: string;
  name: string;
  locationType: 'classroom' | 'bathroom' | 'library' | 'office' | 'nurse' | 'cafeteria';
  responsiblePartyId?: string;
  teacherName?: string;
}

export type PassStatus = 'OPEN' | 'CLOSED' | 'PENDING_APPROVAL';
export type MovementState = 'IN' | 'OUT';

export interface Leg {
  legNumber: number;
  originLocationId: string;
  destinationLocationId: string;
  state: MovementState; // IN or OUT
  timestamp: Date;
  id: string;
}

export interface Pass {
  id: string;
  studentId: string;
  status: PassStatus;
  createdAt: Date;
  lastUpdatedAt: Date;
  legs: Leg[];
  closedBy?: string; // User ID of who closed the pass
  closedAt?: Date;
  // Duration tracking for notifications
  durationMinutes?: number; // Current duration in minutes
  lastNotificationAt?: Date; // Last time a notification was sent
  notificationLevel?: 'none' | 'student' | 'teacher' | 'admin'; // Current notification level
  claimedBy?: {
    userId: string;
    userName: string;
    timestamp: Date;
  };
}

export interface EventLog {
  id: string;
  passId: string;
  studentId: string;
  actorId: string; // Who performed the action
  timestamp: Date;
  eventType: 'DEPARTED' | 'RETURNED' | 'PASS_CREATED' | 'PASS_CLOSED' | 'ARRIVED' | 'NEW_DESTINATION' | 'INVALID_TRANSITION' | 'POLICY_DENIED' | 'ERROR' | 'NOTIFICATION_SENT' | 'NOTIFICATION_FAILED';
  details?: string;
  notificationLevel?: 'student' | 'teacher' | 'admin';
}

// Simple interfaces for UI components
export interface PassFormData {
  destinationLocationId: string;
}

export interface LocationOption {
  id: string;
  name: string;
  locationType: Location['locationType'];
} 