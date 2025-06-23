import { NextRequest, NextResponse } from 'next/server';
import { SessionManager, SessionData } from './sessionManager';

export interface AuthenticatedRequest extends NextRequest {
  session?: SessionData;
}

export interface SessionMiddlewareOptions {
  requireAuth?: boolean;
  allowedRoles?: string[];
  redirectToLogin?: boolean;
}

/**
 * Middleware to validate session for API routes
 */
export async function withSession(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options: SessionMiddlewareOptions = {}
): Promise<NextResponse> {
  const {
    requireAuth = true,
    allowedRoles = [],
    redirectToLogin = false
  } = options;

  try {
    // Get session token from headers or cookies
    const sessionToken = getSessionToken(request);
    
    if (!sessionToken) {
      if (requireAuth) {
        if (redirectToLogin) {
          return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      // Continue without session
      return handler(request as AuthenticatedRequest);
    }

    // Validate session
    const validation = await SessionManager.validateSession(sessionToken);
    
    if (!validation.valid) {
      if (requireAuth) {
        if (redirectToLogin) {
          return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.json(
          { error: validation.error || 'Invalid session' },
          { status: 401 }
        );
      }
      // Continue without session
      return handler(request as AuthenticatedRequest);
    }

    const session = validation.session!;

    // Check role permissions if specified
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Refresh session if needed
    if (validation.shouldRefresh) {
      await SessionManager.refreshSession(sessionToken);
    }

    // Add session to request
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.session = session;

    return handler(authenticatedRequest);

  } catch (error) {
    console.error('Session middleware error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract session token from request
 */
function getSessionToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-Session-Token header
  const sessionHeader = request.headers.get('x-session-token');
  if (sessionHeader) {
    return sessionHeader;
  }

  // Check cookies
  const sessionCookie = request.cookies.get('sessionToken');
  if (sessionCookie) {
    return sessionCookie.value;
  }

  return null;
}

/**
 * Helper function to create authenticated API route
 */
export function createAuthenticatedRoute(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options: SessionMiddlewareOptions = {}
) {
  return async (request: NextRequest) => {
    return withSession(request, handler, options);
  };
}

/**
 * Helper function to create role-restricted API route
 */
export function createRoleRestrictedRoute(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  allowedRoles: string[]
) {
  return createAuthenticatedRoute(handler, {
    requireAuth: true,
    allowedRoles,
    redirectToLogin: false
  });
}

/**
 * Helper function to create admin-only API route
 */
export function createAdminRoute(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return createRoleRestrictedRoute(handler, ['admin', 'dev']);
}

/**
 * Helper function to create teacher-only API route
 */
export function createTeacherRoute(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return createRoleRestrictedRoute(handler, ['teacher', 'admin', 'dev']);
} 