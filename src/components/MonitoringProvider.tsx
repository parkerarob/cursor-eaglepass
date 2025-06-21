"use client";

import { useEffect } from 'react';
import { monitoringService } from '@/lib/monitoringService';

interface MonitoringProviderProps {
  children: React.ReactNode;
}

export function MonitoringProvider({ children }: MonitoringProviderProps) {
  useEffect(() => {
    // Initialize monitoring service
    monitoringService.initialize();

    // Log application startup
    monitoringService.logInfo('Application started', {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });

    // Cleanup on unmount
    return () => {
      monitoringService.cleanup();
    };
  }, []);

  return <>{children}</>;
} 