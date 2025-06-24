import { NextRequest } from 'next/server';
import { GET, POST } from '../../../../api/parent/directory-info/route';

// Mock the FERPA service
jest.mock('@/lib/ferpaService', () => ({
  FERPAService: {
    submitDirectoryInfoOptOut: jest.fn(),
    checkDirectoryInfoPermission: jest.fn(),
  },
}));

// Mock the directory info service
jest.mock('@/lib/directoryInfoService', () => ({
  DirectoryInfoItem: {
    NAME: 'NAME',
    ADDRESS: 'ADDRESS',
    PHONE: 'PHONE',
    EMAIL: 'EMAIL',
    PHOTO: 'PHOTO',
  },
}));

// Mock console.error to avoid noise in tests
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('/api/parent/directory-info', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('POST', () => {
    const validRequestBody = {
      parentId: 'parent1',
      studentId: 'student1',
      studentName: 'John Doe',
      optOutItems: ['NAME', 'ADDRESS'],
    };

    it('should submit directory info opt-out with valid data', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.submitDirectoryInfoOptOut.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/parent/directory-info', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: 'Directory information opt-out submitted successfully',
      });
      expect(FERPAService.submitDirectoryInfoOptOut).toHaveBeenCalledWith(
        'parent1',
        'student1',
        'John Doe',
        ['NAME', 'ADDRESS']
      );
    });

    it('should return 400 when parentId is missing', async () => {
      const { parentId, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/directory-info', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId, studentName, optOutItems',
      });
    });

    it('should return 400 when studentId is missing', async () => {
      const { studentId, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/directory-info', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId, studentName, optOutItems',
      });
    });

    it('should return 400 when studentName is missing', async () => {
      const { studentName, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/directory-info', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId, studentName, optOutItems',
      });
    });

    it('should return 400 when optOutItems is missing', async () => {
      const { optOutItems, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/directory-info', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId, studentName, optOutItems',
      });
    });

    it('should return 500 when FERPAService throws an error', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.submitDirectoryInfoOptOut.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/parent/directory-info', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to submit directory information opt-out',
      });
    });

    it('should handle empty optOutItems array', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.submitDirectoryInfoOptOut.mockResolvedValue(undefined);

      const requestBody = { ...validRequestBody, optOutItems: [] };
      const request = new NextRequest('http://localhost/api/parent/directory-info', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: 'Directory information opt-out submitted successfully',
      });
    });
  });

  describe('GET', () => {
    it('should check directory info permission with valid parameters', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.checkDirectoryInfoPermission.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/parent/directory-info?studentId=student1&infoType=NAME');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allowed: true,
        studentId: 'student1',
        infoType: 'NAME',
      });
      expect(FERPAService.checkDirectoryInfoPermission).toHaveBeenCalledWith('student1', 'NAME');
    });

    it('should return false when permission is denied', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.checkDirectoryInfoPermission.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/parent/directory-info?studentId=student1&infoType=ADDRESS');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        allowed: false,
        studentId: 'student1',
        infoType: 'ADDRESS',
      });
    });

    it('should return 400 when studentId is missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/directory-info?infoType=NAME');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameters: studentId, infoType',
      });
    });

    it('should return 400 when infoType is missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/directory-info?studentId=student1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameters: studentId, infoType',
      });
    });

    it('should return 400 when both parameters are missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/directory-info');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameters: studentId, infoType',
      });
    });

    it('should return 400 when infoType is invalid', async () => {
      const request = new NextRequest('http://localhost/api/parent/directory-info?studentId=student1&infoType=INVALID');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Invalid infoType parameter',
      });
    });

    it('should handle all valid directory info types', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.checkDirectoryInfoPermission.mockResolvedValue(true);

      const validTypes = ['NAME', 'ADDRESS', 'PHONE', 'EMAIL', 'PHOTO'];

      for (const infoType of validTypes) {
        const request = new NextRequest(`http://localhost/api/parent/directory-info?studentId=student1&infoType=${infoType}`);
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          allowed: true,
          studentId: 'student1',
          infoType,
        });
      }
    });

    it('should return 500 when FERPAService throws an error', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.checkDirectoryInfoPermission.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/parent/directory-info?studentId=student1&infoType=NAME');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to check directory information permission',
      });
    });

    it('should handle empty parameter values', async () => {
      const request = new NextRequest('http://localhost/api/parent/directory-info?studentId=&infoType=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameters: studentId, infoType',
      });
    });
  });
}); 