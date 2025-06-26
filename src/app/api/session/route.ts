import { NextRequest, NextResponse } from 'next/server';
import { SessionManager, SessionData } from '@/lib/auth/sessionManager';
import { adminAuth } from '@/lib/firebase/config.server';
import { getUserByEmail } from '@/lib/firebase/firestore';

// GET handler to validate an existing session token from headers
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }

  const result = await SessionManager.validateSession(token);
  if (result.valid && result.session) {
    return NextResponse.json(result.session);
  } else {
    return NextResponse.json({ error: result.error || 'Invalid session' }, { status: 401 });
  }
}

// POST handler to create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    // Verify the Firebase ID token to get user info
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userProfile = await getUserByEmail(decodedToken.email!);

    if (!userProfile) {
      throw new Error(`User profile not found for email: ${decodedToken.email}`);
    }

    // Create a new session using our custom Redis-based session manager
    const sessionToken = await SessionManager.createSession(
      userProfile.id,
      userProfile.email,
      userProfile.role,
      userProfile.schoolId || 'default-school',
      request.headers.get('user-agent') || undefined,
      request.ip
    );

    return NextResponse.json({ status: 'success', sessionToken });
  } catch (error) {
    console.error('Session creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
    return NextResponse.json({ error: errorMessage }, { status: 401 });
  }
}

// DELETE handler to invalidate a session
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }
    
    await SessionManager.invalidateSession(token);
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Session logout error:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
} 