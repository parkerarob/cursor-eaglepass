'use client';
import { useEffect, useState } from 'react';
import { EmergencyBanner } from './EmergencyBanner';
import { subscribeToEmergencyState } from '@/lib/firebase/firestore';

export const GlobalEmergencyBanner = () => {
  const [emergencyState, setEmergencyState] = useState<{ active: boolean; activatedBy?: string; activatedAt?: Date } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToEmergencyState(setEmergencyState);
    return () => unsubscribe();
  }, []);

  return (
    <EmergencyBanner
      active={!!emergencyState?.active}
      activatedBy={emergencyState?.activatedBy}
      activatedAt={emergencyState?.activatedAt}
    />
  );
}; 