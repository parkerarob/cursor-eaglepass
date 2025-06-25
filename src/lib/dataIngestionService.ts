import { writeBatch, doc, collection, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { User, Location } from '@/types';
import { Group, AutonomyMatrix, Restriction } from '@/types/policy';
import { monitoringService } from '@/lib/monitoringService';

export interface CSVSchema {
  name: string;
  requiredFields: string[];
  optionalFields: string[];
  fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'date' | 'email'>;
  validationRules?: Record<string, (value: unknown) => boolean>;
}

export interface IngestionResult {
  success: boolean;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value?: unknown;
  }>;
  auditRecord: {
    timestamp: Date;
    operation: string;
    schema: string;
    summary: string;
  };
}

export interface CSVData {
  headers: string[];
  rows: string[][];
}

// Define schemas for different data types
export const CSV_SCHEMAS: Record<string, CSVSchema> = {
  users: {
    name: 'Users',
    requiredFields: ['id', 'email', 'role'],
    optionalFields: ['name', 'firstName', 'lastName', 'assignedLocationId'],
    fieldTypes: {
      id: 'string',
      email: 'email',
      name: 'string',
      firstName: 'string',
      lastName: 'string',
      role: 'string',
      assignedLocationId: 'string'
    },
    validationRules: {
      email: (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      role: (value: unknown) => typeof value === 'string' && ['student', 'teacher', 'admin', 'dev'].includes(value.toLowerCase()),
    }
  },
  locations: {
    name: 'Locations',
    requiredFields: ['id', 'name', 'locationType'],
    optionalFields: ['responsiblePartyId'],
    fieldTypes: {
      id: 'string',
      name: 'string',
      locationType: 'string',
      responsiblePartyId: 'string'
    },
    validationRules: {
      locationType: (value: unknown) => typeof value === 'string' && ['classroom', 'bathroom', 'office', 'library', 'nurse', 'cafeteria'].includes(value.toLowerCase()),
    }
  },
  groups: {
    name: 'Groups',
    requiredFields: ['id', 'name', 'groupType'],
    optionalFields: ['assignedStudents', 'description'],
    fieldTypes: {
      id: 'string',
      name: 'string',
      groupType: 'string',
      assignedStudents: 'string',
      description: 'string'
    },
    validationRules: {
      groupType: (value: unknown) => typeof value === 'string' && ['positive', 'negative'].includes(value.toLowerCase()),
    }
  },
  autonomyMatrix: {
    name: 'Autonomy Matrix',
    requiredFields: ['id', 'locationId', 'autonomyType'],
    optionalFields: ['groupId', 'description'],
    fieldTypes: {
      id: 'string',
      locationId: 'string',
      autonomyType: 'string',
      groupId: 'string',
      description: 'string'
    },
    validationRules: {
      autonomyType: (value: unknown) => typeof value === 'string' && ['allow', 'disallow', 'require_approval'].includes(value.toLowerCase()),
    }
  },
  restrictions: {
    name: 'Restrictions',
    requiredFields: ['id', 'studentId', 'restrictionType', 'createdBy'],
    optionalFields: ['isActive', 'reason', 'locationId'],
    fieldTypes: {
      id: 'string',
      studentId: 'string',
      restrictionType: 'string',
      createdBy: 'string',
      isActive: 'boolean',
      reason: 'string',
      locationId: 'string'
    },
    validationRules: {
      restrictionType: (value: unknown) => typeof value === 'string' && ['global', 'class_level'].includes(value.toLowerCase()),
      isActive: (value: unknown) => value === undefined || typeof value === 'boolean' || (typeof value === 'string' && ['true', 'false', '1', '0'].includes(value.toLowerCase())),
    }
  }
};

class DataIngestionService {
  /**
   * Parse CSV content into structured data
   */
  public parseCSV(csvContent: string): CSVData {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );

    return { headers, rows };
  }

  /**
   * Validate CSV against schema
   */
  public validateCSV(csvData: CSVData, schema: CSVSchema): IngestionResult {
    const errors: IngestionResult['errors'] = [];
    const totalRecords = csvData.rows.length;
    let successfulRecords = 0;

    // Validate headers
    const missingRequiredFields = schema.requiredFields.filter(
      field => !csvData.headers.includes(field)
    );

    if (missingRequiredFields.length > 0) {
      errors.push({
        row: 0,
        field: 'headers',
        message: `Missing required fields: ${missingRequiredFields.join(', ')}`
      });
      return {
        success: false,
        totalRecords,
        successfulRecords: 0,
        failedRecords: totalRecords,
        errors,
        auditRecord: {
          timestamp: new Date(),
          operation: 'validation',
          schema: schema.name,
          summary: `Validation failed: Missing required fields`
        }
      };
    }

    // Validate each row
    csvData.rows.forEach((row, rowIndex) => {
      const rowData: Record<string, unknown> = {};
      let rowValid = true;

      // Map row data to headers
      csvData.headers.forEach((header, colIndex) => {
        rowData[header] = row[colIndex] || '';
      });

      // Validate required fields
      schema.requiredFields.forEach(field => {
        if (!rowData[field] || (typeof rowData[field] === 'string' && rowData[field].trim() === '')) {
          errors.push({
            row: rowIndex + 1,
            field,
            message: `Required field is empty`,
            value: rowData[field]
          });
          rowValid = false;
        }
      });

      // Validate field types and rules
      Object.entries(rowData).forEach(([field, value]) => {
        if (schema.fieldTypes[field]) {
          const fieldType = schema.fieldTypes[field];
          
          // Type validation
          if (!this.validateFieldType(value, fieldType)) {
            errors.push({
              row: rowIndex + 1,
              field,
              message: `Invalid type. Expected ${fieldType}`,
              value
            });
            rowValid = false;
          }

          // Custom validation rules
          if (schema.validationRules?.[field]) {
            if (!schema.validationRules[field](value)) {
              errors.push({
                row: rowIndex + 1,
                field,
                message: `Failed validation rule`,
                value
              });
              rowValid = false;
            }
          }
        }
      });

      if (rowValid) {
        successfulRecords++;
      }
    });

    return {
      success: errors.length === 0,
      totalRecords,
      successfulRecords,
      failedRecords: totalRecords - successfulRecords,
      errors,
      auditRecord: {
        timestamp: new Date(),
        operation: 'validation',
        schema: schema.name,
        summary: `Validated ${totalRecords} records: ${successfulRecords} valid, ${totalRecords - successfulRecords} invalid`
      }
    };
  }

  /**
   * Validate field type
   */
  private validateFieldType(value: unknown, type: string): boolean {
    if (value === undefined || value === null || value === '') {
      return true; // Allow empty values for optional fields
    }

    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return !isNaN(Number(value));
      case 'boolean':
        return ['true', 'false', '1', '0', true, false].includes(value as string | boolean);
      case 'date':
        return !isNaN(Date.parse(String(value)));
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      default:
        return true;
    }
  }

  /**
   * Convert CSV row to typed object
   */
  private convertRowToObject(row: string[], headers: string[], schema: CSVSchema): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    
    headers.forEach((header, index) => {
      let value: unknown = row[index] || '';
      
      // Convert based on field type
      if (schema.fieldTypes[header]) {
        value = this.convertValue(row[index] || '', schema.fieldTypes[header]);
      }
      
      obj[header] = value;
    });

    return obj;
  }

  /**
   * Convert value to appropriate type
   */
  private convertValue(value: string, type: string): unknown {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    switch (type) {
      case 'string':
        return value;
      case 'number':
        return Number(value);
      case 'boolean':
        return ['true', '1'].includes(value.toLowerCase());
      case 'date':
        return new Date(value);
      case 'email':
        return value.toLowerCase();
      default:
        return value;
    }
  }

  /**
   * Ingest users data
   */
  public async ingestUsers(csvData: CSVData): Promise<IngestionResult> {
    return this.measureApiCall('ingest_users', async () => {
      const schema = CSV_SCHEMAS.users;
      const validation = this.validateCSV(csvData, schema);
      
      if (!validation.success) {
        return validation;
      }

      const batch = writeBatch(db);
      const errors: IngestionResult['errors'] = [];
      let successfulRecords = 0;

      csvData.rows.forEach((row, rowIndex) => {
        try {
          const userData = this.convertRowToObject(row, csvData.headers, schema) as Record<string, string>;
          
          // Create user document with custom ID from spreadsheet
          const userDoc = doc(db, 'users', userData.id);
          const user: User = {
            id: userData.id,
            email: userData.email,
            role: userData.role.toLowerCase() as 'student' | 'teacher' | 'admin' | 'dev',
            assignedLocationId: userData.assignedLocationId,
            // Handle both new firstName/lastName format and legacy name format
            ...(userData.firstName && userData.lastName ? {
              firstName: userData.firstName,
              lastName: userData.lastName,
            } : {
              name: userData.name,
            }),
          };

          batch.set(userDoc, user);
          successfulRecords++;
        } catch (error) {
          errors.push({
            row: rowIndex + 1,
            field: 'general',
            message: `Failed to process user: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value: row.join(',')
          });
        }
      });

      try {
        await batch.commit();
      } catch (error) {
        errors.push({
          row: 0,
          field: 'batch_commit',
          message: `Failed to commit batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        successfulRecords = 0;
      }

      const result = {
        success: errors.length === 0,
        totalRecords: csvData.rows.length,
        successfulRecords,
        failedRecords: csvData.rows.length - successfulRecords,
        errors,
        auditRecord: {
          timestamp: new Date(),
          operation: 'ingest_users',
          schema: schema.name,
          summary: `Ingested ${successfulRecords} users, ${csvData.rows.length - successfulRecords} failed`
        }
      };

      await this.logAuditRecord(result);
      return result;
    });
  }

  /**
   * Ingest locations data
   */
  public async ingestLocations(csvData: CSVData): Promise<IngestionResult> {
    return this.measureApiCall('ingest_locations', async () => {
      const schema = CSV_SCHEMAS.locations;
      const validation = this.validateCSV(csvData, schema);
      
      if (!validation.success) {
        return validation;
      }

      const batch = writeBatch(db);
      const errors: IngestionResult['errors'] = [];
      let successfulRecords = 0;

      csvData.rows.forEach((row, rowIndex) => {
        try {
          const locationData = this.convertRowToObject(row, csvData.headers, schema) as Record<string, string>;
          
          // Create location document with custom ID from spreadsheet
          const locationDoc = doc(db, 'locations', locationData.id);
          const location: Partial<Location> = {
            id: locationData.id,
            name: locationData.name,
            locationType: locationData.locationType.toLowerCase() as 'classroom' | 'bathroom' | 'nurse' | 'office' | 'library' | 'cafeteria',
          };

          if (locationData.responsiblePartyId) {
            location.responsiblePartyId = locationData.responsiblePartyId;
          }

          batch.set(locationDoc, location);
          successfulRecords++;
        } catch (error) {
          errors.push({
            row: rowIndex + 1,
            field: 'general',
            message: `Failed to process location: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value: row.join(',')
          });
        }
      });

      try {
        await batch.commit();
      } catch (error) {
        errors.push({
          row: 0,
          field: 'batch_commit',
          message: `Failed to commit batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        successfulRecords = 0;
      }

      const result = {
        success: errors.length === 0,
        totalRecords: csvData.rows.length,
        successfulRecords,
        failedRecords: csvData.rows.length - successfulRecords,
        errors,
        auditRecord: {
          timestamp: new Date(),
          operation: 'ingest_locations',
          schema: schema.name,
          summary: `Ingested ${successfulRecords} locations, ${csvData.rows.length - successfulRecords} failed`
        }
      };

      await this.logAuditRecord(result);
      return result;
    });
  }

  /**
   * Ingest groups data
   */
  public async ingestGroups(csvData: CSVData): Promise<IngestionResult> {
    return this.measureApiCall('ingest_groups', async () => {
      const schema = CSV_SCHEMAS.groups;
      const validation = this.validateCSV(csvData, schema);
      
      if (!validation.success) {
        return validation;
      }

      const batch = writeBatch(db);
      const errors: IngestionResult['errors'] = [];
      let successfulRecords = 0;

      csvData.rows.forEach((row, rowIndex) => {
        try {
          const groupData = this.convertRowToObject(row, csvData.headers, schema) as Record<string, string>;
          
          // Create group document with custom ID from spreadsheet
          const groupDoc = doc(db, 'groups', groupData.id);
          const group: Group = {
            id: groupData.id,
            name: groupData.name,
            groupType: groupData.groupType.toLowerCase() as 'Positive' | 'Negative',
            ownerId: 'admin-00001',
            assignedStudents: groupData.assignedStudents ? groupData.assignedStudents.split(',').map((s: string) => s.trim()) : [],
            description: groupData.description,
            createdAt: new Date(),
            lastUpdatedAt: new Date()
          };

          batch.set(groupDoc, group);
          successfulRecords++;
        } catch (error) {
          errors.push({
            row: rowIndex + 1,
            field: 'general',
            message: `Failed to process group: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value: row.join(',')
          });
        }
      });

      try {
        await batch.commit();
      } catch (error) {
        errors.push({
          row: 0,
          field: 'batch_commit',
          message: `Failed to commit batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        successfulRecords = 0;
      }

      const result = {
        success: errors.length === 0,
        totalRecords: csvData.rows.length,
        successfulRecords,
        failedRecords: csvData.rows.length - successfulRecords,
        errors,
        auditRecord: {
          timestamp: new Date(),
          operation: 'ingest_groups',
          schema: schema.name,
          summary: `Ingested ${successfulRecords} groups, ${csvData.rows.length - successfulRecords} failed`
        }
      };

      await this.logAuditRecord(result);
      return result;
    });
  }

  /**
   * Ingest autonomy matrix data
   */
  public async ingestAutonomyMatrix(csvData: CSVData): Promise<IngestionResult> {
    return this.measureApiCall('ingest_autonomy_matrix', async () => {
      const schema = CSV_SCHEMAS.autonomyMatrix;
      const validation = this.validateCSV(csvData, schema);
      
      if (!validation.success) {
        return validation;
      }

      const batch = writeBatch(db);
      const errors: IngestionResult['errors'] = [];
      let successfulRecords = 0;

      csvData.rows.forEach((row, rowIndex) => {
        try {
          const matrixData = this.convertRowToObject(row, csvData.headers, schema) as Record<string, string>;
          
          // Create autonomy matrix document with custom ID from spreadsheet
          const matrixDoc = doc(db, 'autonomyMatrix', matrixData.id);
          const matrix: AutonomyMatrix = {
            id: matrixData.id,
            locationId: matrixData.locationId,
            autonomyType: matrixData.autonomyType.toLowerCase() as 'Allow' | 'Disallow' | 'Require Approval',
            groupId: matrixData.groupId,
            description: matrixData.description,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          batch.set(matrixDoc, matrix);
          successfulRecords++;
        } catch (error) {
          errors.push({
            row: rowIndex + 1,
            field: 'general',
            message: `Failed to process autonomy matrix: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value: row.join(',')
          });
        }
      });

      try {
        await batch.commit();
      } catch (error) {
        errors.push({
          row: 0,
          field: 'batch_commit',
          message: `Failed to commit batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        successfulRecords = 0;
      }

      const result = {
        success: errors.length === 0,
        totalRecords: csvData.rows.length,
        successfulRecords,
        failedRecords: csvData.rows.length - successfulRecords,
        errors,
        auditRecord: {
          timestamp: new Date(),
          operation: 'ingest_autonomy_matrix',
          schema: schema.name,
          summary: `Ingested ${successfulRecords} autonomy matrix entries, ${csvData.rows.length - successfulRecords} failed`
        }
      };

      await this.logAuditRecord(result);
      return result;
    });
  }

  /**
   * Ingest restrictions data
   */
  public async ingestRestrictions(csvData: CSVData): Promise<IngestionResult> {
    return this.measureApiCall('ingest_restrictions', async () => {
      const schema = CSV_SCHEMAS.restrictions;
      const validation = this.validateCSV(csvData, schema);
      
      if (!validation.success) {
        return validation;
      }

      const batch = writeBatch(db);
      const errors: IngestionResult['errors'] = [];
      let successfulRecords = 0;

      csvData.rows.forEach((row, rowIndex) => {
        try {
          const restrictionData = this.convertRowToObject(row, csvData.headers, schema) as Record<string, string | boolean>;
          
          // Create restriction document with custom ID from spreadsheet
          const restrictionDoc = doc(db, 'restrictions', restrictionData.id as string);
          const restriction: Restriction = {
            id: restrictionData.id as string,
            studentId: restrictionData.studentId as string,
            restrictionType: (restrictionData.restrictionType as string).toLowerCase() as 'Global' | 'Class-Level',
            isActive: restrictionData.isActive !== undefined ? Boolean(restrictionData.isActive) : true,
            reason: restrictionData.reason as string | undefined,
            locationId: restrictionData.locationId as string | undefined,
            createdBy: restrictionData.createdBy as string,
            createdAt: new Date()
          };

          batch.set(restrictionDoc, restriction);
          successfulRecords++;
        } catch (error) {
          errors.push({
            row: rowIndex + 1,
            field: 'general',
            message: `Failed to process restriction: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value: row.join(',')
          });
        }
      });

      try {
        await batch.commit();
      } catch (error) {
        errors.push({
          row: 0,
          field: 'batch_commit',
          message: `Failed to commit batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        successfulRecords = 0;
      }

      const result = {
        success: errors.length === 0,
        totalRecords: csvData.rows.length,
        successfulRecords,
        failedRecords: csvData.rows.length - successfulRecords,
        errors,
        auditRecord: {
          timestamp: new Date(),
          operation: 'ingest_restrictions',
          schema: schema.name,
          summary: `Ingested ${successfulRecords} restrictions, ${csvData.rows.length - successfulRecords} failed`
        }
      };

      await this.logAuditRecord(result);
      return result;
    });
  }

  /**
   * Log ingestion audit record
   */
  private async logAuditRecord(result: IngestionResult): Promise<void> {
    try {
      const auditDoc = doc(collection(db, 'ingestionAudit'));
      await setDoc(auditDoc, {
        ...result.auditRecord,
        timestamp: Timestamp.fromDate(result.auditRecord.timestamp),
        details: {
          totalRecords: result.totalRecords,
          successfulRecords: result.successfulRecords,
          failedRecords: result.failedRecords,
          errorCount: result.errors.length
        }
      });

      // Log to monitoring service
      if (result.success) {
        monitoringService.logInfo(`Data ingestion completed successfully`, {
          operation: result.auditRecord.operation,
          schema: result.auditRecord.schema,
          totalRecords: result.totalRecords,
          successfulRecords: result.successfulRecords
        });
      } else {
        monitoringService.logError(`Data ingestion failed`, {
          operation: result.auditRecord.operation,
          schema: result.auditRecord.schema,
          totalRecords: result.totalRecords,
          failedRecords: result.failedRecords,
          errors: result.errors
        });
      }
    } catch (error) {
      monitoringService.logError('Failed to log audit record', { error });
    }
  }

  /**
   * Measure API call performance
   */
  private async measureApiCall<T>(apiName: string, apiCall: () => Promise<T>): Promise<T> {
    return monitoringService.measureApiCall(apiName, apiCall);
  }
}

// Export singleton instance
export const dataIngestionService = new DataIngestionService(); 