'use client';

import { useState, useEffect } from 'react';
import { useSession } from './SessionProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Clock, AlertTriangle } from 'lucide-react';

export function SessionTimeoutWarning() {
  const { timeUntilExpiry, refreshSession, logout } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Show warning when less than 5 minutes remaining
  const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  const CRITICAL_THRESHOLD = 1 * 60 * 1000; // 1 minute

  useEffect(() => {
    if (!timeUntilExpiry) {
      setShowWarning(false);
      return;
    }

    if (timeUntilExpiry <= WARNING_THRESHOLD && timeUntilExpiry > 0) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [timeUntilExpiry]);

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
      setShowWarning(false);
    } catch (error) {
      console.error('Failed to refresh session:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setShowWarning(false);
  };

  const formatTimeRemaining = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const isCritical = timeUntilExpiry && timeUntilExpiry <= CRITICAL_THRESHOLD;

  if (!showWarning || !timeUntilExpiry) {
    return null;
  }

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCritical ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <Clock className="h-5 w-5 text-orange-500" />
            )}
            Session Timeout Warning
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert variant={isCritical ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isCritical ? (
                <span className="font-semibold">
                  Your session will expire in {formatTimeRemaining(timeUntilExpiry)}!
                </span>
              ) : (
                <span>
                  Your session will expire in {formatTimeRemaining(timeUntilExpiry)}.
                  Would you like to extend your session?
                </span>
              )}
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isRefreshing}
            >
              Logout Now
            </Button>
            <Button
              onClick={handleRefreshSession}
              disabled={isRefreshing}
              className={isCritical ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {isRefreshing ? "Extending..." : "Extend Session"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 