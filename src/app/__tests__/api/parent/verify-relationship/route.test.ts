import { NextRequest } from 'next/server';
import { POST } from '@/app/api/parent/verify-relationship/route';

// Mock the FERPA service
jest.mock('@/lib/ferpaService', () => ({
  FERPAService: {
    verifyParentRelationship: jest.fn(),
  },
}));

describe('/api/parent/verify-relationship', () => {
  const { FERPAService } = require('@/lib/ferpaService');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should verify parent relationship successfully', async () => {
      FERPAService.verifyParentRelationship.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: '123e4567-e89b-12d3-a456-426614174001',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        verified: true,
        parentId: '123e4567-e89b-12d3-a456-426614174000',
        studentId: '123e4567-e89b-12d3-a456-426614174001',
      });

      expect(FERPAService.verifyParentRelationship).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001');
    });

    it('should return false when relationship is not verified', async () => {
      FERPAService.verifyParentRelationship.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: '123e4567-e89b-12d3-a456-426614174002',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        verified: false,
        parentId: '123e4567-e89b-12d3-a456-426614174000',
        studentId: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(FERPAService.verifyParentRelationship).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174002');
    });

    function expectZodError(data: { error: string }, field: string, code: string = 'invalid_string') {
      let errors: Array<{ path: string[]; code: string }>;
      try {
        errors = JSON.parse(data.error);
      } catch {
        throw new Error('Error is not a valid JSON string');
      }
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.some((e: { path: string[]; code: string }) => e.path && e.path[0] === field && e.code === code)).toBe(true);
    }

    it('should return 400 when parentId is missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          studentId: '123e4567-e89b-12d3-a456-426614174001',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'parentId', 'invalid_type');
      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when studentId is missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: '123e4567-e89b-12d3-a456-426614174000',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'studentId', 'invalid_type');
      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when both fields are missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'parentId', 'invalid_type');
      expectZodError(data, 'studentId', 'invalid_type');
      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when fields are empty strings', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: '',
          studentId: '',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'parentId');
      expectZodError(data, 'studentId');
      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when parentId is not a valid UUID', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: 'not-a-uuid',
          studentId: '123e4567-e89b-12d3-a456-426614174000',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'parentId');
      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when studentId is not a valid UUID', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: 'not-a-uuid',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'studentId');
      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 500 when FERPA service throws an error', async () => {
      FERPAService.verifyParentRelationship.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: '123e4567-e89b-12d3-a456-426614174000',
          studentId: '123e4567-e89b-12d3-a456-426614174001',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to verify parent relationship',
      });
    });

    it('should return 400 when request body is malformed JSON', async () => {
      // Simulate a request with invalid JSON by overriding the json() method
      const request = {
        json: async () => { throw new Error('Unexpected token < in JSON'); }
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(typeof data.error).toBe('string');
    });

    it('should return 400 when complex parent and student IDs are used', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: 'parent-complex-id-123-abc',
          studentId: 'student-complex-id-456-def',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'parentId');
      expectZodError(data, 'studentId');
    });

    it('should return 400 when null values are provided', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: null,
          studentId: null,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'parentId', 'invalid_type');
      expectZodError(data, 'studentId', 'invalid_type');
    });

    it('should return 400 when undefined values are provided', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: undefined,
          studentId: undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expectZodError(data, 'parentId', 'invalid_type');
      expectZodError(data, 'studentId', 'invalid_type');
    });
  });
}); 