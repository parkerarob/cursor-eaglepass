import { dataIngestionService, CSV_SCHEMAS } from '../dataIngestionService';
import { User, Location } from '@/types';
import { Group, AutonomyMatrix, Restriction } from '@/types/policy';
import { writeBatch, doc, collection, setDoc } from 'firebase/firestore';
import { monitoringService } from '../monitoringService';

// Mock Firebase functions
jest.mock('firebase/firestore', () => ({
  writeBatch: jest.fn(),
  doc: jest.fn(),
  collection: jest.fn(),
  setDoc: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date) => ({ toDate: () => date }))
  }
}));

jest.mock('@/lib/firebase/firestore', () => ({
  db: {}
}));

jest.mock('../monitoringService', () => ({
  monitoringService: {
    logInfo: jest.fn(),
    logError: jest.fn(),
    measureApiCall: jest.fn()
  }
}));

const mockWriteBatch = writeBatch as jest.MockedFunction<typeof writeBatch>;
const mockDoc = doc as jest.MockedFunction<typeof doc>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;

describe('DataIngestionService', () => {
  let mockBatch: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock batch
    mockBatch = {
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    };
    mockWriteBatch.mockReturnValue(mockBatch);
    mockDoc.mockReturnValue({ path: 'mock/path' } as any);
    mockCollection.mockReturnValue({ path: 'mock/collection' } as any);
    mockSetDoc.mockResolvedValue(undefined);
    
    // Mock measureApiCall to execute the callback
    (monitoringService.measureApiCall as jest.Mock).mockImplementation(
      async (name: string, callback: () => Promise<any>) => callback()
    );
  });

  describe('CSV_SCHEMAS', () => {
    it('should have all required schemas defined', () => {
      expect(CSV_SCHEMAS.users).toBeDefined();
      expect(CSV_SCHEMAS.locations).toBeDefined();
      expect(CSV_SCHEMAS.groups).toBeDefined();
      expect(CSV_SCHEMAS.autonomyMatrix).toBeDefined();
      expect(CSV_SCHEMAS.restrictions).toBeDefined();
    });

    it('should have correct structure for users schema', () => {
      const schema = CSV_SCHEMAS.users;
      expect(schema.name).toBe('Users');
      expect(schema.requiredFields).toEqual(['id', 'email', 'role']);
      expect(schema.optionalFields).toEqual(['name', 'firstName', 'lastName', 'assignedLocationId']);
      expect(schema.fieldTypes.email).toBe('email');
      expect(schema.validationRules?.email).toBeDefined();
      expect(schema.validationRules?.role).toBeDefined();
    });

    it('should validate email format correctly', () => {
      const emailValidator = CSV_SCHEMAS.users.validationRules?.email;
      expect(emailValidator?.('test@example.com')).toBe(true);
      expect(emailValidator?.('invalid-email')).toBe(false);
      expect(emailValidator?.('')).toBe(false);
    });

    it('should validate user roles correctly', () => {
      const roleValidator = CSV_SCHEMAS.users.validationRules?.role;
      expect(roleValidator?.('student')).toBe(true);
      expect(roleValidator?.('TEACHER')).toBe(true);
      expect(roleValidator?.('admin')).toBe(true);
      expect(roleValidator?.('dev')).toBe(true);
      expect(roleValidator?.('invalid')).toBe(false);
    });

    it('should validate location types correctly', () => {
      const typeValidator = CSV_SCHEMAS.locations.validationRules?.locationType;
      expect(typeValidator?.('classroom')).toBe(true);
      expect(typeValidator?.('BATHROOM')).toBe(true);
      expect(typeValidator?.('invalid')).toBe(false);
    });

    it('should validate group types correctly', () => {
      const typeValidator = CSV_SCHEMAS.groups.validationRules?.groupType;
      expect(typeValidator?.('positive')).toBe(true);
      expect(typeValidator?.('NEGATIVE')).toBe(true);
      expect(typeValidator?.('invalid')).toBe(false);
    });

    it('should validate autonomy types correctly', () => {
      const typeValidator = CSV_SCHEMAS.autonomyMatrix.validationRules?.autonomyType;
      expect(typeValidator?.('allow')).toBe(true);
      expect(typeValidator?.('DISALLOW')).toBe(true);
      expect(typeValidator?.('require_approval')).toBe(true);
      expect(typeValidator?.('invalid')).toBe(false);
    });

    it('should validate restriction types correctly', () => {
      const typeValidator = CSV_SCHEMAS.restrictions.validationRules?.restrictionType;
      expect(typeValidator?.('global')).toBe(true);
      expect(typeValidator?.('CLASS_LEVEL')).toBe(true);
      expect(typeValidator?.('invalid')).toBe(false);
    });

    it('should validate boolean values correctly', () => {
      const boolValidator = CSV_SCHEMAS.restrictions.validationRules?.isActive;
      expect(boolValidator?.('true')).toBe(true);
      expect(boolValidator?.('false')).toBe(true);
      expect(boolValidator?.('1')).toBe(true);
      expect(boolValidator?.('0')).toBe(true);
      expect(boolValidator?.(true)).toBe(true);
      expect(boolValidator?.(false)).toBe(true);
      expect(boolValidator?.(undefined)).toBe(true);
      expect(boolValidator?.('invalid')).toBe(false);
    });
  });

  describe('parseCSV', () => {
    it('should parse simple CSV correctly', () => {
      const csvContent = 'id,name,email\n1,John,john@test.com\n2,Jane,jane@test.com';
      const result = dataIngestionService.parseCSV(csvContent);
      
      expect(result.headers).toEqual(['id', 'name', 'email']);
      expect(result.rows).toEqual([
        ['1', 'John', 'john@test.com'],
        ['2', 'Jane', 'jane@test.com']
      ]);
    });

    it('should handle CSV with quotes', () => {
      const csvContent = '"id","name","email"\n"1","John Doe","john@test.com"';
      const result = dataIngestionService.parseCSV(csvContent);
      
      expect(result.headers).toEqual(['id', 'name', 'email']);
      expect(result.rows).toEqual([['1', 'John Doe', 'john@test.com']]);
    });

    it('should handle CSV with extra whitespace', () => {
      const csvContent = ' id , name , email \n 1 , John , john@test.com ';
      const result = dataIngestionService.parseCSV(csvContent);
      
      expect(result.headers).toEqual(['id', 'name', 'email']);
      expect(result.rows).toEqual([['1', 'John', 'john@test.com']]);
    });

    it('should handle empty CSV gracefully', () => {
      // Empty string becomes [''] after split, so headers = [''] and rows = []
      const result1 = dataIngestionService.parseCSV('');
      expect(result1.headers).toEqual(['']);
      expect(result1.rows).toEqual([]);
      
      // Whitespace only also becomes [''] after trim and split
      const result2 = dataIngestionService.parseCSV('   ');
      expect(result2.headers).toEqual(['']);
      expect(result2.rows).toEqual([]);
    });

    it('should handle single header row', () => {
      const csvContent = 'id,name,email';
      const result = dataIngestionService.parseCSV(csvContent);
      
      expect(result.headers).toEqual(['id', 'name', 'email']);
      expect(result.rows).toEqual([]);
    });
  });

  describe('validateCSV', () => {
    const validCSVData = {
      headers: ['id', 'email', 'role'],
      rows: [
        ['user1', 'user1@test.com', 'student'],
        ['user2', 'user2@test.com', 'teacher']
      ]
    };

    it('should validate correct CSV data', () => {
      const result = dataIngestionService.validateCSV(validCSVData, CSV_SCHEMAS.users);
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRecords).toBe(2);
      expect(result.auditRecord.operation).toBe('validation');
    });

    it('should fail validation when required fields are missing from headers', () => {
      const invalidCSVData = {
        headers: ['id', 'name'], // missing email and role
        rows: [['user1', 'User One']]
      };
      
      const result = dataIngestionService.validateCSV(invalidCSVData, CSV_SCHEMAS.users);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('headers');
      expect(result.errors[0].message).toContain('Missing required fields: email, role');
      expect(result.auditRecord.summary).toContain('Validation failed');
    });

    it('should fail validation when required field values are missing', () => {
      const invalidCSVData = {
        headers: ['id', 'email', 'role'],
        rows: [
          ['user1', '', 'student'], // missing email
          ['', 'user2@test.com', 'teacher'] // missing id
        ]
      };
      
      const result = dataIngestionService.validateCSV(invalidCSVData, CSV_SCHEMAS.users);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
      expect(result.errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should validate field types and validation rules', () => {
      const invalidCSVData = {
        headers: ['id', 'email', 'role'],
        rows: [
          ['user1', 'invalid-email', 'student'],
          ['user2', 'user2@test.com', 'invalid-role']
        ]
      };
      
      const result = dataIngestionService.validateCSV(invalidCSVData, CSV_SCHEMAS.users);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.field === 'email')).toBe(true);
      expect(result.errors.some(e => e.field === 'role')).toBe(true);
    });

    it('should handle empty rows', () => {
      const csvData = {
        headers: ['id', 'email', 'role'],
        rows: [
          ['user1', 'user1@test.com', 'student'],
          ['', '', ''], // completely empty row
          ['user3', 'user3@test.com', 'teacher']
        ]
      };
      
      const result = dataIngestionService.validateCSV(csvData, CSV_SCHEMAS.users);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.row === 2)).toBe(true);
    });

    it('should validate optional fields when present', () => {
      const csvData = {
        headers: ['id', 'email', 'role', 'name'],
        rows: [
          ['user1', 'user1@test.com', 'student', 'John Doe']
        ]
      };
      
      const result = dataIngestionService.validateCSV(csvData, CSV_SCHEMAS.users);
      
      expect(result.success).toBe(true);
    });
  });

  describe('validateFieldType (private method)', () => {
    // Access private method through service instance
    const validateFieldType = (dataIngestionService as any).validateFieldType.bind(dataIngestionService);

    it('should validate string type', () => {
      expect(validateFieldType('hello', 'string')).toBe(true);
      expect(validateFieldType(123, 'string')).toBe(false);
      expect(validateFieldType('', 'string')).toBe(true); // empty is allowed
    });

    it('should validate number type', () => {
      expect(validateFieldType('123', 'number')).toBe(true);
      expect(validateFieldType('123.45', 'number')).toBe(true);
      expect(validateFieldType('not-a-number', 'number')).toBe(false);
      expect(validateFieldType('', 'number')).toBe(true); // empty is allowed
    });

    it('should validate boolean type', () => {
      expect(validateFieldType('true', 'boolean')).toBe(true);
      expect(validateFieldType('false', 'boolean')).toBe(true);
      expect(validateFieldType('1', 'boolean')).toBe(true);
      expect(validateFieldType('0', 'boolean')).toBe(true);
      expect(validateFieldType(true, 'boolean')).toBe(true);
      expect(validateFieldType(false, 'boolean')).toBe(true);
      expect(validateFieldType('invalid', 'boolean')).toBe(false);
    });

    it('should validate date type', () => {
      expect(validateFieldType('2023-01-01', 'date')).toBe(true);
      expect(validateFieldType('January 1, 2023', 'date')).toBe(true);
      expect(validateFieldType('invalid-date', 'date')).toBe(false);
      expect(validateFieldType('', 'date')).toBe(true); // empty is allowed
    });

    it('should validate email type', () => {
      expect(validateFieldType('test@example.com', 'email')).toBe(true);
      expect(validateFieldType('invalid-email', 'email')).toBe(false);
      expect(validateFieldType('', 'email')).toBe(true); // empty is allowed
    });

    it('should return true for unknown types', () => {
      expect(validateFieldType('anything', 'unknown-type')).toBe(true);
    });

    it('should allow null/undefined/empty values', () => {
      expect(validateFieldType(null, 'string')).toBe(true);
      expect(validateFieldType(undefined, 'string')).toBe(true);
      expect(validateFieldType('', 'string')).toBe(true);
    });
  });

  describe('convertValue (private method)', () => {
    const convertValue = (dataIngestionService as any).convertValue.bind(dataIngestionService);

    it('should convert string values', () => {
      expect(convertValue('hello', 'string')).toBe('hello');
      expect(convertValue('', 'string')).toBeUndefined();
    });

    it('should convert number values', () => {
      expect(convertValue('123', 'number')).toBe(123);
      expect(convertValue('123.45', 'number')).toBe(123.45);
      expect(convertValue('', 'number')).toBeUndefined();
    });

    it('should convert boolean values', () => {
      expect(convertValue('true', 'boolean')).toBe(true);
      expect(convertValue('1', 'boolean')).toBe(true);
      expect(convertValue('false', 'boolean')).toBe(false);
      expect(convertValue('0', 'boolean')).toBe(false);
      expect(convertValue('', 'boolean')).toBeUndefined();
    });

    it('should convert date values', () => {
      const result = convertValue('2023-01-01', 'date');
      expect(result).toBeInstanceOf(Date);
      expect(convertValue('', 'date')).toBeUndefined();
    });

    it('should convert email values to lowercase', () => {
      expect(convertValue('TEST@EXAMPLE.COM', 'email')).toBe('test@example.com');
      expect(convertValue('', 'email')).toBeUndefined();
    });

    it('should return original value for unknown types', () => {
      expect(convertValue('test', 'unknown')).toBe('test');
    });

    it('should handle null/undefined input', () => {
      expect(convertValue(null as any, 'string')).toBeUndefined();
      expect(convertValue(undefined as any, 'string')).toBeUndefined();
    });
  });

  describe('convertRowToObject (private method)', () => {
    const convertRowToObject = (dataIngestionService as any).convertRowToObject.bind(dataIngestionService);

    it('should convert row to object correctly', () => {
      const row = ['user1', 'user1@test.com', 'student'];
      const headers = ['id', 'email', 'role'];
      const schema = CSV_SCHEMAS.users;
      
      const result = convertRowToObject(row, headers, schema);
      
      expect(result).toEqual({
        id: 'user1',
        email: 'user1@test.com',
        role: 'student'
      });
    });

    it('should handle missing values in row', () => {
      const row = ['user1', '', 'student']; // missing email
      const headers = ['id', 'email', 'role'];
      const schema = CSV_SCHEMAS.users;
      
      const result = convertRowToObject(row, headers, schema);
      
      expect(result).toEqual({
        id: 'user1',
        email: undefined,
        role: 'student'
      });
    });

    it('should handle row shorter than headers', () => {
      const row = ['user1']; // missing email and role
      const headers = ['id', 'email', 'role'];
      const schema = CSV_SCHEMAS.users;
      
      const result = convertRowToObject(row, headers, schema);
      
      expect(result).toEqual({
        id: 'user1',
        email: undefined,
        role: undefined
      });
    });

    it('should convert types based on schema', () => {
      const row = ['user1', 'USER1@TEST.COM', 'student'];
      const headers = ['id', 'email', 'role'];
      const schema = CSV_SCHEMAS.users;
      
      const result = convertRowToObject(row, headers, schema);
      
      expect(result.email).toBe('user1@test.com'); // converted to lowercase
    });
  });

  describe('ingestUsers', () => {
    const validUserCSV = {
      headers: ['id', 'email', 'role', 'name'],
      rows: [
        ['user1', 'user1@test.com', 'student', 'John Doe'],
        ['user2', 'user2@test.com', 'teacher', 'Jane Smith']
      ]
    };

    it('should successfully ingest valid user data', async () => {
      const result = await dataIngestionService.ingestUsers(validUserCSV);
      
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
      expect(result.failedRecords).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.auditRecord.operation).toBe('ingest_users');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('should handle firstName/lastName format', async () => {
      const csvData = {
        headers: ['id', 'email', 'role', 'firstName', 'lastName'],
        rows: [['user1', 'user1@test.com', 'student', 'John', 'Doe']]
      };
      
      const result = await dataIngestionService.ingestUsers(csvData);
      
      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe'
        })
      );
    });

    it('should handle legacy name format', async () => {
      const csvData = {
        headers: ['id', 'email', 'role', 'name'],
        rows: [['user1', 'user1@test.com', 'student', 'John Doe']]
      };
      
      const result = await dataIngestionService.ingestUsers(csvData);
      
      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'John Doe'
        })
      );
    });

    it('should return validation errors for invalid data', async () => {
      const invalidCSV = {
        headers: ['id', 'email'],
        rows: [['user1', 'user1@test.com']]
      };
      
      const result = await dataIngestionService.ingestUsers(invalidCSV);
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.field === 'headers')).toBe(true);
    });

    it('should handle batch commit failure', async () => {
      mockBatch.commit.mockRejectedValueOnce(new Error('Firestore error'));
      
      const result = await dataIngestionService.ingestUsers(validUserCSV);
      
      expect(result.success).toBe(false);
      expect(result.successfulRecords).toBe(0);
      expect(result.errors.some(e => e.field === 'batch_commit')).toBe(true);
    });

    it('should handle row processing errors', async () => {
      // Mock doc to throw error
      mockDoc.mockImplementationOnce(() => {
        throw new Error('Document creation error');
      });
      
      const result = await dataIngestionService.ingestUsers(validUserCSV);
      
      expect(result.errors.some(e => e.field === 'general')).toBe(true);
    });

    it('should call measureApiCall', async () => {
      await dataIngestionService.ingestUsers(validUserCSV);
      
      expect(monitoringService.measureApiCall).toHaveBeenCalledWith(
        'ingest_users',
        expect.any(Function)
      );
    });
  });

  describe('ingestLocations', () => {
    const validLocationCSV = {
      headers: ['id', 'name', 'locationType', 'responsiblePartyId'],
      rows: [
        ['loc1', 'Classroom A', 'classroom', 'teacher1'],
        ['loc2', 'Library', 'library', 'librarian1']
      ]
    };

    it('should successfully ingest valid location data', async () => {
      const result = await dataIngestionService.ingestLocations(validLocationCSV);
      
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
      expect(result.auditRecord.operation).toBe('ingest_locations');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });

    it('should handle optional responsiblePartyId', async () => {
      const csvData = {
        headers: ['id', 'name', 'locationType'],
        rows: [['loc1', 'Classroom A', 'classroom']]
      };
      
      const result = await dataIngestionService.ingestLocations(csvData);
      
      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          responsiblePartyId: expect.anything()
        })
      );
    });

    it('should handle batch commit failure', async () => {
      mockBatch.commit.mockRejectedValueOnce(new Error('Firestore error'));
      
      const result = await dataIngestionService.ingestLocations(validLocationCSV);
      
      expect(result.success).toBe(false);
      expect(result.successfulRecords).toBe(0);
    });

    it('should call measureApiCall', async () => {
      await dataIngestionService.ingestLocations(validLocationCSV);
      
      expect(monitoringService.measureApiCall).toHaveBeenCalledWith(
        'ingest_locations',
        expect.any(Function)
      );
    });
  });

  describe('ingestGroups', () => {
    const validGroupCSV = {
      headers: ['id', 'name', 'groupType', 'assignedStudents', 'description'],
      rows: [
        ['group1', 'Honor Roll', 'positive', 'student1,student2', 'High achievers'],
        ['group2', 'Detention', 'negative', 'student3', 'Disciplinary group']
      ]
    };

    it('should successfully ingest valid group data', async () => {
      const result = await dataIngestionService.ingestGroups(validGroupCSV);
      
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
      expect(result.auditRecord.operation).toBe('ingest_groups');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });

    it('should parse assignedStudents correctly', async () => {
      await dataIngestionService.ingestGroups(validGroupCSV);
      
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          assignedStudents: ['student1', 'student2']
        })
      );
    });

    it('should handle empty assignedStudents', async () => {
      const csvData = {
        headers: ['id', 'name', 'groupType'],
        rows: [['group1', 'Honor Roll', 'positive']]
      };
      
      const result = await dataIngestionService.ingestGroups(csvData);
      
      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          assignedStudents: []
        })
      );
    });

    it('should call measureApiCall', async () => {
      await dataIngestionService.ingestGroups(validGroupCSV);
      
      expect(monitoringService.measureApiCall).toHaveBeenCalledWith(
        'ingest_groups',
        expect.any(Function)
      );
    });
  });

  describe('ingestAutonomyMatrix', () => {
    const validMatrixCSV = {
      headers: ['id', 'locationId', 'autonomyType', 'groupId', 'description'],
      rows: [
        ['matrix1', 'loc1', 'allow', 'group1', 'Allow group1 in loc1'],
        ['matrix2', 'loc2', 'disallow', 'group2', 'Disallow group2 in loc2']
      ]
    };

    it('should successfully ingest valid autonomy matrix data', async () => {
      const result = await dataIngestionService.ingestAutonomyMatrix(validMatrixCSV);
      
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
      expect(result.auditRecord.operation).toBe('ingest_autonomy_matrix');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });

    it('should convert autonomyType to proper case', async () => {
      await dataIngestionService.ingestAutonomyMatrix(validMatrixCSV);
      
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          autonomyType: 'allow'
        })
      );
    });

    it('should call measureApiCall', async () => {
      await dataIngestionService.ingestAutonomyMatrix(validMatrixCSV);
      
      expect(monitoringService.measureApiCall).toHaveBeenCalledWith(
        'ingest_autonomy_matrix',
        expect.any(Function)
      );
    });
  });

  describe('ingestRestrictions', () => {
    const validRestrictionCSV = {
      headers: ['id', 'studentId', 'restrictionType', 'createdBy', 'isActive', 'reason'],
      rows: [
        ['restriction1', 'student1', 'global', 'admin1', 'true', 'Behavioral issues'],
        ['restriction2', 'student2', 'class_level', 'teacher1', 'false', 'Temporary restriction']
      ]
    };

    it('should successfully ingest valid restriction data', async () => {
      const result = await dataIngestionService.ingestRestrictions(validRestrictionCSV);
      
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.successfulRecords).toBe(2);
      expect(result.auditRecord.operation).toBe('ingest_restrictions');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
    });

    it('should convert boolean values correctly', async () => {
      await dataIngestionService.ingestRestrictions(validRestrictionCSV);
      
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: true
        })
      );
    });

    it('should default isActive to true when undefined', async () => {
      const csvData = {
        headers: ['id', 'studentId', 'restrictionType', 'createdBy'],
        rows: [['restriction1', 'student1', 'global', 'admin1']]
      };
      
      const result = await dataIngestionService.ingestRestrictions(csvData);
      
      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: true
        })
      );
    });

    it('should call measureApiCall', async () => {
      await dataIngestionService.ingestRestrictions(validRestrictionCSV);
      
      expect(monitoringService.measureApiCall).toHaveBeenCalledWith(
        'ingest_restrictions',
        expect.any(Function)
      );
    });
  });

  describe('logAuditRecord (private method)', () => {
    it('should log successful ingestion', async () => {
      const mockResult = {
        success: true,
        totalRecords: 5,
        successfulRecords: 5,
        failedRecords: 0,
        errors: [],
        auditRecord: {
          timestamp: new Date(),
          operation: 'ingest_users',
          schema: 'Users',
          summary: 'Test summary'
        }
      };

      await (dataIngestionService as any).logAuditRecord(mockResult);

      expect(mockSetDoc).toHaveBeenCalled();
      expect(monitoringService.logInfo).toHaveBeenCalledWith(
        'Data ingestion completed successfully',
        expect.objectContaining({
          operation: 'ingest_users',
          schema: 'Users'
        })
      );
    });

    it('should log failed ingestion', async () => {
      const mockResult = {
        success: false,
        totalRecords: 5,
        successfulRecords: 3,
        failedRecords: 2,
        errors: [{ row: 1, field: 'email', message: 'Invalid email' }],
        auditRecord: {
          timestamp: new Date(),
          operation: 'ingest_users',
          schema: 'Users',
          summary: 'Test summary'
        }
      };

      await (dataIngestionService as any).logAuditRecord(mockResult);

      expect(monitoringService.logError).toHaveBeenCalledWith(
        'Data ingestion failed',
        expect.objectContaining({
          operation: 'ingest_users',
          failedRecords: 2
        })
      );
    });

    it('should handle audit logging failure', async () => {
      mockSetDoc.mockRejectedValueOnce(new Error('Firestore error'));
      
      const mockResult = {
        success: true,
        totalRecords: 1,
        successfulRecords: 1,
        failedRecords: 0,
        errors: [],
        auditRecord: {
          timestamp: new Date(),
          operation: 'test',
          schema: 'Test',
          summary: 'Test'
        }
      };

      await (dataIngestionService as any).logAuditRecord(mockResult);

      expect(monitoringService.logError).toHaveBeenCalledWith(
        'Failed to log audit record',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('measureApiCall (private method)', () => {
    it('should delegate to monitoringService', async () => {
      const testCallback = jest.fn().mockResolvedValue('test result');
      
      const result = await (dataIngestionService as any).measureApiCall('test_api', testCallback);
      
      expect(monitoringService.measureApiCall).toHaveBeenCalledWith('test_api', testCallback);
      expect(result).toBe('test result');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete user ingestion workflow', async () => {
      const csvContent = 'id,email,role,name\nuser1,user1@test.com,student,John Doe\nuser2,user2@test.com,teacher,Jane Smith';
      
      const csvData = dataIngestionService.parseCSV(csvContent);
      const validation = dataIngestionService.validateCSV(csvData, CSV_SCHEMAS.users);
      expect(validation.success).toBe(true);
      
      const result = await dataIngestionService.ingestUsers(csvData);
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
    });

    it('should handle end-to-end failure scenarios', async () => {
      const csvContent = 'id,name\nuser1,John'; // missing required email and role
      
      const csvData = dataIngestionService.parseCSV(csvContent);
      const result = await dataIngestionService.ingestUsers(csvData);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle all data types in sequence', async () => {
      // Test multiple data types with proper schemas
      const userCSV = {
        headers: ['id', 'email', 'role'],
        rows: [['user1', 'user1@test.com', 'student']]
      };
      
      const locationCSV = {
        headers: ['id', 'name', 'locationType'],
        rows: [['loc1', 'Classroom A', 'classroom']]
      };
      
      const groupCSV = {
        headers: ['id', 'name', 'groupType'],
        rows: [['group1', 'Honor Roll', 'positive']]
      };
      
      const matrixCSV = {
        headers: ['id', 'locationId', 'autonomyType'],
        rows: [['matrix1', 'loc1', 'allow']]
      };
      
      const restrictionCSV = {
        headers: ['id', 'studentId', 'restrictionType', 'createdBy'],
        rows: [['restriction1', 'student1', 'global', 'admin1']]
      };

      const userResult = await dataIngestionService.ingestUsers(userCSV);
      const locationResult = await dataIngestionService.ingestLocations(locationCSV);
      const groupResult = await dataIngestionService.ingestGroups(groupCSV);
      const matrixResult = await dataIngestionService.ingestAutonomyMatrix(matrixCSV);
      const restrictionResult = await dataIngestionService.ingestRestrictions(restrictionCSV);

      expect(userResult.success).toBe(true);
      expect(locationResult.success).toBe(true);
      expect(groupResult.success).toBe(true);
      expect(matrixResult.success).toBe(true);
      expect(restrictionResult.success).toBe(true);
    });
  });
}); 