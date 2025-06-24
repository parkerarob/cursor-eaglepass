import { NextRequest } from 'next/server';
import { GET, POST } from '../../../../api/parent/relationships/route';

// Mock the FERPA service
jest.mock('@/lib/ferpaService', () => ({
  FERPAService: {
    getParentRelationships: jest.fn(),
    createParentRelationship: jest.fn(),
  },
}));

// Mock console.error to avoid noise in tests
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('/api/parent/relationships', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('GET', () => {
    it('should return parent relationships when parentId is provided', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      const mockRelationships = [
        {
          parentId: 'parent1',
          studentId: 'student1',
          relationshipType: 'parent',
          verified: true,
        },
      ];
      FERPAService.getParentRelationships.mockResolvedValue(mockRelationships);

      const request = new NextRequest('http://localhost/api/parent/relationships?parentId=parent1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        relationships: mockRelationships,
        parentId: 'parent1',
      });
      expect(FERPAService.getParentRelationships).toHaveBeenCalledWith('parent1');
    });

    it('should return 400 when parentId is missing', async () => {
      const request = new NextRequest('http://localhost/api/parent/relationships');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameter: parentId',
      });
    });

    it('should return 500 when FERPAService throws an error', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.getParentRelationships.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/parent/relationships?parentId=parent1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to get parent relationships',
      });
    });

    it('should handle empty parentId parameter', async () => {
      const request = new NextRequest('http://localhost/api/parent/relationships?parentId=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required parameter: parentId',
      });
    });
  });

  describe('POST', () => {
    const validRequestBody = {
      parentId: 'parent1',
      parentEmail: 'parent@example.com',
      studentId: 'student1',
      studentName: 'John Doe',
      relationshipType: 'parent',
      verifiedBy: 'admin1',
    };

    it('should create parent relationship with valid data', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.createParentRelationship.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: 'Parent relationship created successfully',
      });
      expect(FERPAService.createParentRelationship).toHaveBeenCalledWith(
        'parent1',
        'parent@example.com',
        'student1',
        'John Doe',
        'parent',
        'admin1'
      );
    });

    it('should return 400 when parentId is missing', async () => {
      const { parentId, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy',
      });
    });

    it('should return 400 when parentEmail is missing', async () => {
      const { parentEmail, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy',
      });
    });

    it('should return 400 when studentId is missing', async () => {
      const { studentId, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy',
      });
    });

    it('should return 400 when studentName is missing', async () => {
      const { studentName, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy',
      });
    });

    it('should return 400 when relationshipType is missing', async () => {
      const { relationshipType, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy',
      });
    });

    it('should return 400 when verifiedBy is missing', async () => {
      const { verifiedBy, ...invalidBody } = validRequestBody;

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy',
      });
    });

    it('should return 500 when FERPAService throws an error', async () => {
      const { FERPAService } = require('@/lib/ferpaService');
      FERPAService.createParentRelationship.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Failed to create parent relationship',
      });
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
    });

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost/api/parent/relationships', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy',
      });
    });
  });
}); 