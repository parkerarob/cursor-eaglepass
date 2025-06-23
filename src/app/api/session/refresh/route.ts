import { NextResponse } from 'next/server';
import { createAuthenticatedRoute, AuthenticatedRequest } from '@/lib/auth/sessionMiddleware';
import { SessionManager } from '@/lib/auth/sessionManager';

async function refreshHandler(request: AuthenticatedRequest): Promise<NextResponse> {
  const { session } = request;

  if (!session) {
    return NextResponse.json(
      { error: 'No session found' },
      { status: 401 }
    );
  }

  try {
    // Get session token from request
    const sessionToken = request.headers.get('x-session-token') || 
                        request.headers.get('authorization')?.replace('Bearer ', '') ||
                        request.cookies.get('sessionToken')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token not found' },
        { status: 401 }
      );
    }

    // Refresh the session
    const success = await SessionManager.refreshSession(sessionToken);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to refresh session' },
        { status: 400 }
      );
    }

    // Get updated session data
    const validation = await SessionManager.validateSession(sessionToken);

    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { error: 'Session validation failed after refresh' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        userId: validation.session.userId,
        email: validation.session.email,
        role: validation.session.role,
        schoolId: validation.session.schoolId,
        createdAt: new Date(validation.session.createdAt).toISOString(),
        lastActivity: new Date(validation.session.lastActivity).toISOString(),
        expiresAt: new Date(validation.session.expiresAt).toISOString(),
        userAgent: validation.session.userAgent,
        ipAddress: validation.session.ipAddress
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh session' },
      { status: 500 }
    );
  }
}

export const POST = createAuthenticatedRoute(refreshHandler, {
  requireAuth: true,
  redirectToLogin: false
}); 