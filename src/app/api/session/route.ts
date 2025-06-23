import { NextResponse } from 'next/server';
import { createAuthenticatedRoute, AuthenticatedRequest } from '@/lib/auth/sessionMiddleware';

async function sessionHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  const { session } = request;

  if (!session) {
    return NextResponse.json(
      { error: 'No session found' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    session: {
      userId: session.userId,
      email: session.email,
      role: session.role,
      schoolId: session.schoolId,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActivity: new Date(session.lastActivity).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress
    },
    timestamp: new Date().toISOString()
  });
}

export const GET = createAuthenticatedRoute(sessionHandler, {
  requireAuth: true,
  redirectToLogin: false
}); 