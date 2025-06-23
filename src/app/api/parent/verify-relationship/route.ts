import { NextRequest, NextResponse } from 'next/server';
import { FERPAService } from '@/lib/ferpaService';

export async function POST(request: NextRequest) {
  try {
    const { parentId, studentId } = await request.json();
    
    if (!parentId || !studentId) {
      return NextResponse.json(
        { error: 'Missing required fields: parentId, studentId' },
        { status: 400 }
      );
    }
    
    const isVerified = await FERPAService.verifyParentRelationship(parentId, studentId);
    
    return NextResponse.json({
      verified: isVerified,
      parentId,
      studentId
    });
    
  } catch (error) {
    console.error('Parent relationship verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify parent relationship' },
      { status: 500 }
    );
  }
} 