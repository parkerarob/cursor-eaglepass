import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/auth/sessionMiddleware';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

async function sessionHandler(request: NextRequest): Promise<NextResponse> {
  // This route is used to check session status
  const method = request.method;
  
  if (method === 'GET') {
    // Return session information if available
    const session = (request as any).session;
    if (session) {
      return NextResponse.json({
        valid: true,
        user: {
          id: session.userId,
          email: session.email,
          role: session.role
        }
      });
    } else {
      return NextResponse.json(
        { valid: false, error: 'No active session' },
        { status: 401 }
      );
    }
  }
  
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export const GET = (request: NextRequest) => {
  return withSession(request, sessionHandler, { requireAuth: false });
}; 