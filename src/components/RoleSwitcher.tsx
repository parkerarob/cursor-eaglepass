'use client';

import { useState } from 'react';
import { useRole } from './RoleProvider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/types';

export function RoleSwitcher() {
  const { currentRole, currentUser, availableRoles, isDevMode, switchRole, resetToOriginalRole, isLoading } = useRole();
  const [isSwitching, setIsSwitching] = useState(false);

  if (!isDevMode) {
    return null; // Only show for dev users
  }

  const handleRoleSwitch = async (role: UserRole) => {
    if (role === currentRole) return;
    
    setIsSwitching(true);
    try {
      await switchRole(role);
    } catch (error) {
      console.error('Failed to switch role:', error);
      // You could add a toast notification here
    } finally {
      setIsSwitching(false);
    }
  };

  const handleReset = async () => {
    setIsSwitching(true);
    try {
      await resetToOriginalRole();
    } catch (error) {
      console.error('Failed to reset role:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'student': return 'bg-blue-100 text-blue-800';
      case 'teacher': return 'bg-green-100 text-green-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'dev': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Dev Mode</h3>
        <Badge variant="outline" className="text-xs">
          {isSwitching ? 'Switching...' : 'Active'}
        </Badge>
      </div>
      
      <div className="space-y-3">
        {/* Current User Info */}
        <div className="text-xs text-gray-600">
          <div>Logged in as: {currentUser?.email}</div>
          <div>Current role: 
            <Badge className={`ml-1 ${getRoleColor(currentRole || 'dev')}`}>
              {currentRole || 'Unknown'}
            </Badge>
          </div>
        </div>

        {/* Role Selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Switch to role:</label>
          <Select 
            value={currentRole || ''} 
            onValueChange={(value) => handleRoleSwitch(value as UserRole)}
            disabled={isSwitching || isLoading}
            data-disabled={isSwitching || isLoading}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role} className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getRoleColor(role)} text-xs`}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleReset}
          disabled={isSwitching || isLoading}
          data-disabled={isSwitching || isLoading}
          className="w-full text-xs"
        >
          Reset to Original Role
        </Button>

        {/* Status */}
        {isSwitching && (
          <div className="text-xs text-blue-600 text-center">
            Switching roles...
          </div>
        )}
      </div>
    </div>
  );
} 