import { NextResponse } from 'next/server';
import { createAuthenticatedRoute, AuthenticatedRequest } from '@/lib/auth/sessionMiddleware';
import { SessionManager } from '@/lib/auth/sessionManager';

async function logoutHandler(request: AuthenticatedRequest): Promise<NextResponse> {
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

    if (sessionToken) {
      await SessionManager.invalidateSession(sessionToken);
    }

    // Create response with cleared cookie
    const response = NextResponse.json({
      success: true,
      message: 'Session invalidated successfully'
    });

    // Clear session cookie
    response.cookies.delete('sessionToken');

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}

export const POST = createAuthenticatedRoute(logoutHandler, {
  requireAuth: true,
  redirectToLogin: false
}); 