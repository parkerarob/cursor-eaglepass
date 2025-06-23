import { NextRequest, NextResponse } from 'next/server';
import { FERPAService } from '@/lib/ferpaService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');
    
    if (!parentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: parentId' },
        { status: 400 }
      );
    }
    
    const relationships = await FERPAService.getParentRelationships(parentId);
    
    return NextResponse.json({
      relationships,
      parentId
    });
    
  } catch (error) {
    console.error('Get parent relationships error:', error);
    return NextResponse.json(
      { error: 'Failed to get parent relationships' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy } = await request.json();
    
    if (!parentId || !parentEmail || !studentId || !studentName || !relationshipType || !verifiedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: parentId, parentEmail, studentId, studentName, relationshipType, verifiedBy' },
        { status: 400 }
      );
    }
    
    await FERPAService.createParentRelationship(
      parentId,
      parentEmail,
      studentId,
      studentName,
      relationshipType,
      verifiedBy
    );
    
    return NextResponse.json({
      success: true,
      message: 'Parent relationship created successfully'
    });
    
  } catch (error) {
    console.error('Create parent relationship error:', error);
    return NextResponse.json(
      { error: 'Failed to create parent relationship' },
      { status: 500 }
    );
  }
} 