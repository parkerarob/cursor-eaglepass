import {
  mockUsers,
  mockLocations,
  mockPasses,
  mockEventLogs,
  getAllLocations,
  getTeacherById,
  getLocationById,
  getActivePassByStudentId,
  getStudentsByLocation,
  getAvailableDestinations
} from '../mockData';

describe('MockData', () => {
  describe('Mock Data Arrays', () => {
    it('should export mockUsers array with correct structure', () => {
      expect(Array.isArray(mockUsers)).toBe(true);
      expect(mockUsers.length).toBeGreaterThan(0);
      
      // Verify first user has required properties
      const firstUser = mockUsers[0];
      expect(firstUser).toHaveProperty('id');
      expect(firstUser).toHaveProperty('firstName');
      expect(firstUser).toHaveProperty('lastName');
      expect(firstUser).toHaveProperty('email');
      expect(firstUser).toHaveProperty('role');
      
      // Verify we have different roles
      const roles = mockUsers.map(user => user.role);
      expect(roles).toContain('student');
      expect(roles).toContain('teacher');
      expect(roles).toContain('admin');
    });

    it('should export mockLocations array with correct structure', () => {
      expect(Array.isArray(mockLocations)).toBe(true);
      expect(mockLocations.length).toBeGreaterThan(0);
      
      // Verify first location has required properties
      const firstLocation = mockLocations[0];
      expect(firstLocation).toHaveProperty('id');
      expect(firstLocation).toHaveProperty('name');
      expect(firstLocation).toHaveProperty('locationType');
      
      // Verify we have different location types
      const types = mockLocations.map(location => location.locationType);
      expect(types).toContain('classroom');
      expect(types).toContain('bathroom');
      expect(types).toContain('office');
    });

    it('should export mockPasses array with correct structure', () => {
      expect(Array.isArray(mockPasses)).toBe(true);
      expect(mockPasses.length).toBeGreaterThan(0);
      
      // Verify first pass has required properties
      const firstPass = mockPasses[0];
      expect(firstPass).toHaveProperty('id');
      expect(firstPass).toHaveProperty('studentId');
      expect(firstPass).toHaveProperty('status');
      expect(firstPass).toHaveProperty('createdAt');
      expect(firstPass).toHaveProperty('legs');
      expect(Array.isArray(firstPass.legs)).toBe(true);
      
      // Verify we have different statuses
      const statuses = mockPasses.map(pass => pass.status);
      expect(statuses).toContain('OPEN');
      expect(statuses).toContain('CLOSED');
    });

    it('should export mockEventLogs array with correct structure', () => {
      expect(Array.isArray(mockEventLogs)).toBe(true);
      expect(mockEventLogs.length).toBeGreaterThan(0);
      
      // Verify first event log has required properties
      const firstLog = mockEventLogs[0];
      expect(firstLog).toHaveProperty('id');
      expect(firstLog).toHaveProperty('eventType');
      expect(firstLog).toHaveProperty('passId');
      expect(firstLog).toHaveProperty('timestamp');
    });
  });

  describe('Utility Functions', () => {
    describe('getAllLocations', () => {
      it('should return all locations', () => {
        const locations = getAllLocations();
        expect(Array.isArray(locations)).toBe(true);
        expect(locations.length).toBe(mockLocations.length);
        expect(locations).toEqual(mockLocations);
      });
    });

    describe('getTeacherById', () => {
      it('should return teacher when valid teacher ID is provided', () => {
        const teacherId = mockUsers.find(u => u.role === 'teacher')?.id;
        expect(teacherId).toBeDefined();
        
        const teacher = getTeacherById(teacherId!);
        expect(teacher).toBeDefined();
        expect(teacher?.role).toBe('teacher');
        expect(teacher?.id).toBe(teacherId);
      });

      it('should return undefined when teacher ID does not exist', () => {
        const teacher = getTeacherById('non-existent-teacher');
        expect(teacher).toBeUndefined();
      });

      it('should return undefined when ID belongs to non-teacher user', () => {
        const studentId = mockUsers.find(u => u.role === 'student')?.id;
        expect(studentId).toBeDefined();
        
        const teacher = getTeacherById(studentId!);
        expect(teacher).toBeUndefined();
      });
    });

    describe('getLocationById', () => {
      it('should return location when valid location ID is provided', () => {
        const locationId = mockLocations[0].id;
        const location = getLocationById(locationId);
        
        expect(location).toBeDefined();
        expect(location?.id).toBe(locationId);
        expect(location).toEqual(mockLocations[0]);
      });

      it('should return undefined when location ID does not exist', () => {
        const location = getLocationById('non-existent-location');
        expect(location).toBeUndefined();
      });
    });

    describe('getActivePassByStudentId', () => {
      it('should return active pass when student has open pass', () => {
        const openPass = mockPasses.find(p => p.status === 'OPEN');
        expect(openPass).toBeDefined();
        
        const activePass = getActivePassByStudentId(openPass!.studentId);
        expect(activePass).toBeDefined();
        expect(activePass?.status).toBe('OPEN');
        expect(activePass?.studentId).toBe(openPass!.studentId);
      });

      it('should return undefined when student has no active pass', () => {
        const closedPass = mockPasses.find(p => p.status === 'CLOSED');
        expect(closedPass).toBeDefined();
        
        // Make sure this student doesn't have any open passes
        const hasOpenPass = mockPasses.some(p => 
          p.studentId === closedPass!.studentId && p.status === 'OPEN'
        );
        
        if (!hasOpenPass) {
          const activePass = getActivePassByStudentId(closedPass!.studentId);
          expect(activePass).toBeUndefined();
        }
      });

      it('should return undefined when student ID does not exist', () => {
        const activePass = getActivePassByStudentId('non-existent-student');
        expect(activePass).toBeUndefined();
      });
    });

    describe('getStudentsByLocation', () => {
      it('should return students assigned to a specific location', () => {
        const locationId = mockUsers.find(u => u.role === 'student')?.assignedLocationId;
        expect(locationId).toBeDefined();
        
        const students = getStudentsByLocation(locationId!);
        expect(Array.isArray(students)).toBe(true);
        expect(students.length).toBeGreaterThan(0);
        
        // Verify all returned users are students
        students.forEach(student => {
          expect(student.role).toBe('student');
          expect(student.assignedLocationId).toBe(locationId);
        });
      });

      it('should return empty array when no students are assigned to location', () => {
        const students = getStudentsByLocation('non-existent-location');
        expect(Array.isArray(students)).toBe(true);
        expect(students.length).toBe(0);
      });
    });

    describe('getAvailableDestinations', () => {
      it('should return filtered locations excluding classrooms', () => {
        const destinations = getAvailableDestinations();
        expect(Array.isArray(destinations)).toBe(true);
        expect(destinations.length).toBeGreaterThan(0);
        
        // Verify no classrooms are included
        const hasClassrooms = destinations.some(dest => dest.locationType === 'classroom');
        expect(hasClassrooms).toBe(false);
        
        // Verify we have other location types
        const types = destinations.map(dest => dest.locationType);
        expect(types).toContain('bathroom');
        expect(types).toContain('office');
      });

      it('should return locations that exist in mockLocations', () => {
        const destinations = getAvailableDestinations();
        
        destinations.forEach(destination => {
          const existsInMock = mockLocations.some(loc => loc.id === destination.id);
          expect(existsInMock).toBe(true);
        });
      });
    });
  });

  describe('Data Integrity', () => {
    it('should have consistent relationships between users and locations', () => {
      // Check that teachers are assigned to classroom locations
      const teachers = mockUsers.filter(u => u.role === 'teacher');
      teachers.forEach(teacher => {
        if (teacher.assignedLocationId) {
          const location = mockLocations.find(l => l.id === teacher.assignedLocationId);
          expect(location).toBeDefined();
          expect(location?.locationType).toBe('classroom');
        }
      });
    });

    it('should have valid student-pass relationships', () => {
      mockPasses.forEach(pass => {
        const student = mockUsers.find(u => u.id === pass.studentId);
        expect(student).toBeDefined();
        expect(student?.role).toBe('student');
      });
    });

    it('should have valid location references in passes', () => {
      mockPasses.forEach(pass => {
        pass.legs.forEach(leg => {
          const originLocation = mockLocations.find(l => l.id === leg.originLocationId);
          const destLocation = mockLocations.find(l => l.id === leg.destinationLocationId);
          
          expect(originLocation).toBeDefined();
          expect(destLocation).toBeDefined();
        });
      });
    });

    it('should have valid event log references', () => {
      mockEventLogs.forEach(log => {
        if (log.passId) {
          const pass = mockPasses.find(p => p.id === log.passId);
          expect(pass).toBeDefined();
        }
        
        if (log.studentId) {
          const student = mockUsers.find(u => u.id === log.studentId);
          expect(student).toBeDefined();
        }
      });
    });
  });
}); 