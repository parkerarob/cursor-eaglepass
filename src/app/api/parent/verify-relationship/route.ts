import { NextRequest, NextResponse } from 'next/server';
import { FERPAService } from '@/lib/ferpaService';
import { parentRelationshipVerifySchema, validateRequest } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    let validated;
    try {
      validated = await validateRequest(request, parentRelationshipVerifySchema);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid request' },
        { status: 400 }
      );
    }
    const { parentId, studentId } = validated;
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