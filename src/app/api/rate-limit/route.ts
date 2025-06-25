import { NextRequest, NextResponse } from 'next/server';
import { checkPassCreationRateLimit, checkLoginRateLimit } from '@/lib/rateLimiterFactory';

export async function POST(request: NextRequest) {
  try {
    const { userId, operation } = await request.json();

    if (!userId || !operation) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, operation' },
        { status: 400 }
      );
    }

    let result;
    switch (operation) {
      case 'PASS_CREATION':
        result = await checkPassCreationRateLimit(userId);
        break;
      case 'LOGIN':
        result = await checkLoginRateLimit(userId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid operation. Must be PASS_CREATION or LOGIN' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail-secure: deny request if Redis rate limiting fails
    return NextResponse.json(
      { 
        allowed: false, 
        error: 'Rate limiting service unavailable. Please try again later.' 
      },
      { status: 503 }
    );
  }
} 