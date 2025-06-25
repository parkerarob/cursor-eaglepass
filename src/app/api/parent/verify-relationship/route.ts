import { NextRequest, NextResponse } from 'next/server';
import { FERPAService } from '@/lib/ferpaService';
import { parentRelationshipVerifySchema, validateRequest } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    let validated;
    try {
      validated = await validateRequest(request, parentRelationshipVerifySchema);
    } catch (error) {
      // If validation fails, return detailed Zod error array as JSON string so tests can inspect
      if (error instanceof Error) {
        // ZodError has 'errors' array with path/code, fall back to message otherwise
        const zodErrors = (error as any).errors;
        return NextResponse.json(
          { error: zodErrors ? JSON.stringify(zodErrors) : error.message },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
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