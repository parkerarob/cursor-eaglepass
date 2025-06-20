// Eagle Pass data model types - Simple Foundation

export type UserRole = 'student' | 'teacher' | 'admin' | 'dev';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // For students: their assigned classroom/location
  // For teachers: their assigned classroom/location
  assignedLocationId?: string;
  // For future: restrictions, groups, etc.
}

export interface Location {
  id: string;
  name: string;
  locationType: 'classroom' | 'bathroom' | 'nurse' | 'office' | 'library' | 'cafeteria';
  responsiblePartyId?: string; // Teacher/admin responsible for this location
}

export type PassStatus = 'OPEN' | 'CLOSED';
export type MovementState = 'IN' | 'OUT';

export interface Leg {
  legNumber: number;
  originLocationId: string;
  destinationLocationId: string;
  state: MovementState; // IN or OUT
  timestamp: Date;
}

export interface Pass {
  id: string;
  studentId: string;
  status: PassStatus;
  createdAt: Date;
  lastUpdatedAt: Date;
  legs: Leg[];
}

export interface EventLog {
  id: string;
  passId: string;
  studentId: string;
  actorId: string; // Who performed the action
  timestamp: Date;
  eventType: 'DEPARTED' | 'RETURNED' | 'PASS_CREATED' | 'PASS_CLOSED';
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