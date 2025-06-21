import React from 'react';

interface EmergencyBannerProps {
  active: boolean;
  activatedBy?: string;
  activatedAt?: Date;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ active, activatedBy, activatedAt }) => {
  if (!active) return null;
  return (
    <div className="w-full bg-red-700 text-white py-3 px-4 text-center font-bold text-lg z-50 fixed top-0 left-0 shadow-lg animate-pulse">
      🚨 EMERGENCY FREEZE ACTIVE 🚨
      {activatedBy && (
        <span className="block text-sm font-normal mt-1">
          Activated by: {activatedBy}
          {activatedAt && (
            <> at {activatedAt.toLocaleTimeString()}</>
          )}
        </span>
      )}
    </div>
  );
}; 