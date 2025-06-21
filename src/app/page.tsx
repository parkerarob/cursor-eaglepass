'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/components/RoleProvider';
import { Login } from '@/components/Login';
import { CreatePassForm } from '@/components/CreatePassForm';
import { PassStatus } from '@/components/PassStatus';
import { DurationTimer } from '@/components/DurationTimer';
import { EmergencyBanner } from '@/components/EmergencyBanner';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { PassService } from '@/lib/passService';
import { getLocationById, getActivePassByStudentId, getEmergencyState } from '@/lib/firebase/firestore';
import { User, Location, Pass, PassFormData } from '@/types';
import { ActionState } from '@/lib/stateMachine';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  const router = useRouter();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { currentUser, currentRole, isDevMode, isLoading: roleLoading } = useRole();
  
  const [currentStudent, setCurrentStudent] = useState<User | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentPass, setCurrentPass] = useState<Pass | null>(null);
  const [actionState, setActionState] = useState<ActionState>({
    isRestroomTrip: false,
    isSimpleTrip: false,
    returnLocationName: 'class',
    canArrive: false,
    canReturnToClass: false,
    destinationName: '',
  });
  const [emergencyState, setEmergencyState] = useState<{ active: boolean; activatedBy?: string; activatedAt?: Date } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle role-based routing and user setup
  useEffect(() => {
    if (authLoading || roleLoading) return;
    
    if (!authUser) {
      setIsLoading(false);
      setCurrentStudent(null);
      setCurrentPass(null);
      return;
    }

    const setupUser = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (!currentUser) {
          setError('User profile not found.');
          return;
        }

        if (currentRole === 'student' || (currentRole === 'dev' && isDevMode)) {
          // For students or dev users in student mode
          setCurrentStudent(currentUser);
        } else if (currentRole === 'teacher' || currentRole === 'admin' || currentRole === 'dev') {
          // Redirect teachers, admins, and dev users to admin interface
          router.push('/admin');
          return;
        } else {
          setError(`This application is for students only. Your role is: ${currentRole}.`);
          setCurrentStudent(null);
        }
      } catch (e) {
        setError((e as Error).message);
        setCurrentStudent(null);
      } finally {
        setIsLoading(false);
      }
    };

    setupUser();
  }, [authUser, authLoading, currentUser, currentRole, isDevMode, roleLoading, router]);

  // Fetch emergency state
  useEffect(() => {
    const fetchEmergencyState = async () => {
      try {
        const state = await getEmergencyState();
        setEmergencyState(state);
      } catch (error) {
        console.error('Failed to fetch emergency state:', error);
      }
    };

    fetchEmergencyState();
  }, []);

  // Fetch student data when currentStudent changes
  useEffect(() => {
    if (!currentStudent) {
      if (!authLoading && !roleLoading) {
        setIsLoading(false);
      }
      return;
    }

    const fetchStudentData = async () => {
      try {
        if (!currentStudent.assignedLocationId) {
          throw new Error(`Your user profile is missing an assigned classroom.`);
        }
        
        const [assignedLocation, pass] = await Promise.all([
          getLocationById(currentStudent.assignedLocationId),
          getActivePassByStudentId(currentStudent.id),
        ]);
        
        if (!assignedLocation) {
          throw new Error(`Could not find your assigned classroom (ID: ${currentStudent.assignedLocationId}).`);
        }

        // Determine current location based on active pass
        let currentLocation = assignedLocation; // Default to assigned class
        
        if (pass && pass.status === 'OPEN') {
          const currentLeg = pass.legs[pass.legs.length - 1];
          if (currentLeg) {
            if (currentLeg.state === 'IN') {
              // Student is "IN" at the destination of the current leg
              const actualLocation = await getLocationById(currentLeg.destinationLocationId);
              if (actualLocation) {
                currentLocation = actualLocation;
              }
            } else if (currentLeg.state === 'OUT') {
              // Student is "OUT" - they're traveling from origin to destination
              // Show where they're coming from (origin)
              const originLocation = await getLocationById(currentLeg.originLocationId);
              if (originLocation) {
                currentLocation = originLocation;
              }
            }
          }
        }
        
        setCurrentLocation(currentLocation);
        setCurrentPass(pass);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [currentStudent, authLoading, roleLoading]);

  // Update action state when pass or student changes
  useEffect(() => {
    if (!currentPass || !currentStudent) {
      return;
    }

    const updateActionState = async () => {
      const newActionState = await PassService.getActionState(currentPass, currentStudent);
      setActionState(newActionState);
    };

    updateActionState();
  }, [currentPass, currentStudent]);

  const handleCreatePass = async (formData: PassFormData) => {
    if (!currentStudent) return;
    setIsLoading(true);
    
    const result = await PassService.createPass(formData, currentStudent);
    if (result.success && result.updatedPass) {
      setCurrentPass(result.updatedPass);
      // Update current location to reflect the new pass state
      await updateCurrentLocation(result.updatedPass);
    } else {
      setError(result.error || 'Failed to create pass');
    }
    setIsLoading(false);
  };

  const handleReturn = async () => {
    if (!currentPass || !currentStudent) return;
    setIsLoading(true);
    
    const result = await PassService.arriveAtDestination(currentPass, currentStudent);
    if (result.success && result.updatedPass) {
      setCurrentPass(result.updatedPass);
      // Update current location to reflect the new pass state
      await updateCurrentLocation(result.updatedPass);
    } else {
      setError(result.error || 'Failed to arrive at destination');
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleReturnToClass = async () => {
    if (!currentPass || !currentStudent) return;
    setIsLoading(true);
    
    const result = await PassService.returnToClass(currentPass, currentStudent);
    if (result.success && result.updatedPass) {
      setCurrentPass(result.updatedPass);
      // Update current location to reflect the new pass state
      await updateCurrentLocation(result.updatedPass);
    } else {
      setError(result.error || 'Failed to return to class');
    }
    setIsLoading(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleClosePass = async () => {
    if (!currentPass || !currentStudent) return;
    setIsLoading(true);
    
    const result = await PassService.closePass(currentPass, currentStudent);
    if (result.success && result.updatedPass) {
      setCurrentPass(result.updatedPass);
      // Update current location to reflect the new pass state
      await updateCurrentLocation(result.updatedPass);
      setTimeout(() => {
        setCurrentPass(null);
        // Reset to assigned class when pass is closed
        if (currentStudent.assignedLocationId) {
          getLocationById(currentStudent.assignedLocationId).then(location => {
            if (location) setCurrentLocation(location);
          });
        }
      }, 1500);
    } else {
      setError(result.error || 'Failed to close pass');
    }
    setIsLoading(false);
  };

  const handleRestroomReturn = async () => {
    if (!currentPass || !currentStudent) return;
    setIsLoading(true);
    
    const result = await PassService.handleRestroomReturn(currentPass, currentStudent);
    if (result.success && result.updatedPass) {
      setCurrentPass(result.updatedPass);
      // Update current location to reflect the new pass state
      await updateCurrentLocation(result.updatedPass);
      // If returning to assigned class, the pass will be closed
      if (result.updatedPass.status === 'CLOSED') {
        setTimeout(() => {
          setCurrentPass(null);
          // Reset to assigned class when pass is closed
          if (currentStudent.assignedLocationId) {
            getLocationById(currentStudent.assignedLocationId).then(location => {
              if (location) setCurrentLocation(location);
            });
          }
        }, 1500);
      }
    } else {
      setError(result.error || 'Failed to return from restroom');
    }
    setIsLoading(false);
  };

  const updateCurrentLocation = async (pass: Pass) => {
    if (pass.legs.length === 0) return;
    
    const currentLeg = pass.legs[pass.legs.length - 1];
    if (currentLeg.state === 'IN') {
      const location = await getLocationById(currentLeg.destinationLocationId);
      if (location) setCurrentLocation(location);
    } else {
      const location = await getLocationById(currentLeg.originLocationId);
      if (location) setCurrentLocation(location);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleResetPass = () => {
    setCurrentPass(null);
    setError(null);
    // Reset to assigned class
    if (currentStudent?.assignedLocationId) {
      getLocationById(currentStudent.assignedLocationId).then(location => {
        if (location) setCurrentLocation(location);
      });
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Login />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Role Switcher for Dev Users */}
      <RoleSwitcher />
      
      {/* Emergency Banner */}
      <EmergencyBanner 
        active={emergencyState?.active || false}
        activatedBy={emergencyState?.activatedBy}
        activatedAt={emergencyState?.activatedAt}
      />
      
      <div className="max-w-md mx-auto p-4">
        {/* Header */}
        <div className="bg-card rounded-lg shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">Eagle Pass</h1>
              <p className="text-muted-foreground">Digital Hall Pass System</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-card-foreground">{currentStudent?.name}</div>
              <div className="text-xs text-muted-foreground">{currentStudent?.email}</div>
              <ThemeToggle />
            </div>
          </div>
          
          {currentLocation && (
            <div className="bg-muted rounded-lg p-3">
              <div className="text-xs text-muted-foreground font-medium mb-1">Current Location</div>
              <div className="text-sm text-muted-foreground">{currentLocation.name}</div>
            </div>
          )}
        </div>

        {/* Main Content */}
        {!currentPass ? (
          <CreatePassForm onCreatePass={handleCreatePass} isLoading={isLoading} />
        ) : currentLocation ? (
          <div className="space-y-4">
            <PassStatus 
              pass={currentPass} 
              studentName={currentStudent?.name || ''}
              currentLocation={currentLocation}
            />
            
            <DurationTimer pass={currentPass} />
            
            {/* Action Buttons */}
            <div className="bg-card rounded-lg shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-semibold text-card-foreground">Actions</h3>

              {actionState.canReturnToClass && (
                <button
                  onClick={handleClosePass}
                  disabled={isLoading}
                  className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  I&apos;m back in class
                </button>
              )}
              
              {actionState.canArrive && (
                <div className="text-center space-y-2 pt-2 border-t border-border">
                   <p className="text-sm text-muted-foreground">Need to stay awhile?</p>
                   <button
                    onClick={handleReturn}
                    disabled={isLoading}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {`Check-In at ${actionState.destinationName || 'Destination'}`}
                  </button>
                </div>
              )}
              
              {actionState.isRestroomTrip && (
                <button
                  onClick={handleRestroomReturn}
                  disabled={isLoading}
                  className="w-full bg-yellow-600 text-white py-3 px-4 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Return from Restroom
                </button>
              )}
              
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-600">
            Loading location information...
          </div>
        )}
      </div>
    </div>
  );
}