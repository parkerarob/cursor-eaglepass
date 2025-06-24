'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { signInWithGoogle } from '@/lib/firebase/auth';
import { useState } from 'react';

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign-in error:', error);
      setError(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Eagle Pass</CardTitle>
          <CardDescription>Please sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-2 text-sm text-red-600 bg-red-50 rounded border border-red-200">
              {error}
            </div>
          )}
          <Button 
            onClick={handleSignIn} 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 