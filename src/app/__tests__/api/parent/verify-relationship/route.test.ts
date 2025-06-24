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
          parentId: 'parent123',
          studentId: 'student456',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        verified: true,
        parentId: 'parent123',
        studentId: 'student456',
      });

      expect(FERPAService.verifyParentRelationship).toHaveBeenCalledWith('parent123', 'student456');
    });

    it('should return false when relationship is not verified', async () => {
      FERPAService.verifyParentRelationship.mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: 'parent123',
          studentId: 'student789',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        verified: false,
        parentId: 'parent123',
        studentId: 'student789',
      });

      expect(FERPAService.verifyParentRelationship).toHaveBeenCalledWith('parent123', 'student789');
    });

    it('should return 400 when parentId is missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student456',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when studentId is missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: 'parent123',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

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
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

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
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when parentId is empty string', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: '',
          studentId: 'student456',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 400 when studentId is empty string', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: 'parent123',
          studentId: '',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should return 500 when FERPA service throws an error', async () => {
      FERPAService.verifyParentRelationship.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: 'parent123',
          studentId: 'student456',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to verify parent relationship',
      });

      expect(FERPAService.verifyParentRelationship).toHaveBeenCalledWith('parent123', 'student456');
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should handle complex parent and student IDs', async () => {
      FERPAService.verifyParentRelationship.mockResolvedValue(true);

      const request = new NextRequest('http://localhost/api/parent/verify-relationship', {
        method: 'POST',
        body: JSON.stringify({
          parentId: 'parent-complex-id-123-abc',
          studentId: 'student-uuid-456-def-789',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        verified: true,
        parentId: 'parent-complex-id-123-abc',
        studentId: 'student-uuid-456-def-789',
      });

      expect(FERPAService.verifyParentRelationship).toHaveBeenCalledWith(
        'parent-complex-id-123-abc',
        'student-uuid-456-def-789'
      );
    });

    it('should handle null values', async () => {
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
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });

    it('should handle undefined values', async () => {
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
      expect(data).toEqual({
        error: 'Missing required fields: parentId, studentId',
      });

      expect(FERPAService.verifyParentRelationship).not.toHaveBeenCalled();
    });
  });
}); 