'use client';

import { useEffect, useState } from 'react';
import { Pass } from '@/types';
import { NotificationService } from '@/lib/notificationService';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface DurationTimerProps {
  pass: Pass;
  className?: string;
}

export function DurationTimer({ pass, className }: DurationTimerProps) {
  const [duration, setDuration] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState({
    durationMinutes: 0,
    notificationLevel: 'none',
    isOverdue: false,
    shouldEscalate: false
  });

  useEffect(() => {
    const updateDuration = () => {
      const currentDuration = NotificationService.calculateDuration(pass);
      setDuration(currentDuration);
      
      const status = NotificationService.getNotificationStatus(pass);
      setNotificationStatus(status);
    };

    // Update immediately
    updateDuration();

    // Update every minute
    const interval = setInterval(updateDuration, 60000);

    return () => clearInterval(interval);
  }, [pass]);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getNotificationBadge = () => {
    if (notificationStatus.isOverdue) {
      return (
        <Badge variant="destructive" className="ml-2" data-testid="duration-badge">
          OVERDUE ({formatDuration(notificationStatus.durationMinutes)})
        </Badge>
      );
    }
    
    if (notificationStatus.shouldEscalate) {
      return (
        <Badge variant="secondary" className="ml-2" data-testid="duration-badge">
          ESCALATED ({formatDuration(notificationStatus.durationMinutes)})
        </Badge>
      );
    }

    return null;
  };

  const getNotificationMessage = () => {
    if (notificationStatus.isOverdue) {
      return "This pass has exceeded the maximum duration and requires immediate attention.";
    }
    
    if (notificationStatus.shouldEscalate) {
      return "This pass has been active for an extended period and may need attention.";
    }

    return null;
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-sm font-medium">Duration:</span>
            <span className="ml-2 text-lg font-bold">{formatDuration(duration)}</span>
            {getNotificationBadge()}
          </div>
          
          {notificationStatus.notificationLevel !== 'none' && (
            <Badge variant="outline" className="text-xs" data-testid="notification-badge">
              {notificationStatus.notificationLevel.toUpperCase()} NOTIFIED
            </Badge>
          )}
        </div>
        
        {getNotificationMessage() && (
          <div className="mt-2 text-sm text-muted-foreground">
            {getNotificationMessage()}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 