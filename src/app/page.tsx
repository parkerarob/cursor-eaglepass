'use client';

import { useState, useEffect } from 'react';
import { Pass, User, Location, PassFormData } from '@/types';
import { PassStatus } from '@/components/PassStatus';
import { CreatePassForm } from '@/components/CreatePassForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getUserById,
  getActivePassByStudentId,
  getUserByEmail,
  getLocationById,
} from '@/lib/firebase/firestore';
import { PassService } from '@/lib/passService';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/components/RoleProvider';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { Login } from '@/components/Login';
import { signOut } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { formatUserName } from '@/lib/utils';
import { createPassAction } from './actions';

export default function Home() {
  const { user: authUser, isLoading: authLoading, sessionToken } = useAuth();
  const { currentUser: roleUser, currentRole, isLoading: roleLoading, isDevMode } = useRole();
  const router = useRouter();

  const [currentStudent, setCurrentStudent] = useState<User | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentPass, setCurrentPass] = useState<Pass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passCreationError, setPassCreationError] = useState<string | null>(null);

  const [actionState, setActionState] = useState({
    isRestroomTrip: false,
    isSimpleTrip: false,
    returnLocationName: 'class',
    canArrive: false,
  });

  useEffect(() => {
    const isFirebaseConfigured =
      !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    if (!isFirebaseConfigured) {
      setError(
        'Firebase configuration is missing. Please ensure all NEXT_PUBLIC_FIREBASE_* environment variables are set in your Vercel project settings.'
      );
      setIsLoading(false);
      return;
    }

    if (authLoading || roleLoading) {
      setIsLoading(true);
      return;
    }

    if (!authUser || !roleUser) {
      setIsLoading(false);
      setCurrentStudent(null);
      setCurrentPass(null);
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Use RoleProvider's current user and role
        if (currentRole === 'student') {
          setCurrentStudent(roleUser);
        } else if (currentRole === 'dev') {
          // For dev users, load the test student profile
          const testStudent = await getUserById('student-00001');
          if (testStudent) {
            setCurrentStudent(testStudent);
          } else {
            setError('Could not load test student profile for dev mode.');
            setCurrentStudent(null);
          }
        } else if (currentRole === 'teacher') {
          // Redirect teachers to teacher interface
          router.push('/teacher');
          return;
        } else if (currentRole === 'admin') {
          // Redirect admins to admin interface
          router.push('/admin');
          return;
        } else {
          setError(`This application is for students only. Your role is: ${currentRole}.`);
          setCurrentStudent(null);
        }
      } catch (e) {
        setError((e as Error).message);
        setCurrentStudent(null);
      }
    };

    fetchUserData();
  }, [authUser, authLoading, roleUser, currentRole, roleLoading, router]);

  useEffect(() => {
    if (!currentStudent) {
      if (!authLoading) {
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
  }, [currentStudent, authLoading]);

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

  // Refresh data when session token changes (indicating successful login)
  useEffect(() => {
    if (sessionToken && currentStudent && !isLoading) {
      refreshData();
    }
  }, [sessionToken, currentStudent?.id]); // Only refresh when session token or student ID changes

  // This is the new, simplified handler that calls the Server Action
  const handleCreatePass = async (formData: PassFormData) => {
    if (!currentStudent) return;
    setIsLoading(true);
    setPassCreationError(null);

    try {
      // Call the server action. The student is no longer passed as an argument.
      // The server will identify the user via the session token.
      const result = await createPassAction(formData);

      if (!result.success) {
        setPassCreationError(result.error || 'Failed to create pass.');
        return;
      }

      // Success! Refresh the pass data immediately
      const updatedPass = await getActivePassByStudentId(currentStudent.id);
      setCurrentPass(updatedPass);
      
      // Update current location based on the new pass
      if (updatedPass && updatedPass.status === 'OPEN') {
        const currentLeg = updatedPass.legs[updatedPass.legs.length - 1];
        if (currentLeg && currentLeg.state === 'OUT') {
          // Student is traveling - show origin location
          const originLocation = await getLocationById(currentLeg.originLocationId);
          if (originLocation) {
            setCurrentLocation(originLocation);
          }
        }
      }
    } catch (error) {
      console.error('Pass creation error:', error);
      setPassCreationError('An unexpected error occurred while creating the pass.');
    } finally {
      setIsLoading(false);
    }
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

  const handleClosePass = async () => {
    if (!currentPass || !currentStudent) return;
    setIsLoading(true);
    
    // TODO: Refactor PassService to not be called from client
    // For now, this is a placeholder to show how headers would be passed
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
      setError(result.error || 'Failed to handle restroom return');
    }
    setIsLoading(false);
  };

  // Helper function to update current location based on pass state
  const updateCurrentLocation = async (pass: Pass) => {
    if (!currentStudent) return;
    
    const currentLeg = pass.legs[pass.legs.length - 1];
    if (currentLeg) {
      if (currentLeg.state === 'IN') {
        // Student is "IN" at the destination of the current leg
        const actualLocation = await getLocationById(currentLeg.destinationLocationId);
        if (actualLocation) {
          setCurrentLocation(actualLocation);
        }
      } else if (currentLeg.state === 'OUT') {
        // Student is "OUT" - they're traveling from origin to destination
        // Show where they're coming from (origin)
        const originLocation = await getLocationById(currentLeg.originLocationId);
        if (originLocation) {
          setCurrentLocation(originLocation);
        }
      }
    }
  };

  const handleResetPass = () => {
    setCurrentPass(null);
    // Reset to assigned class when pass is reset
    if (currentStudent?.assignedLocationId) {
      getLocationById(currentStudent.assignedLocationId).then(location => {
        if (location) setCurrentLocation(location);
      });
    }
  };

  // This section needs to be refactored to use Server Actions as well,
  // but for now, we'll pass the session token in the headers for the old service.
  const getAuthHeaders = () => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  // Add a refresh function to manually trigger data reload
  const refreshData = async () => {
    if (!authUser || !currentStudent) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [assignedLocation, pass] = await Promise.all([
        getLocationById(currentStudent.assignedLocationId!),
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

  if (isLoading || authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!authUser || !roleUser) {
    return <Login />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">An Error Occurred</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={signOut} variant="outline">Sign Out</Button>
      </div>
    );
  }

  if (!currentStudent || !currentLocation) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p>An unknown error occurred while loading student data.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Role Switcher for Dev Users */}
      <RoleSwitcher />
      
      <ThemeToggle />
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-3xl font-bold">Eagle Pass</h1>
            {currentStudent && (
              <p className="text-muted-foreground">
                Welcome, {formatUserName(currentStudent) || ''}
                {isDevMode && <Badge variant="destructive" className="ml-2">DEV MODE</Badge>}
              </p>
            )}
          </div>
          <Button onClick={signOut} variant="outline" size="sm">Sign Out</Button>
        </header>
        
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">
            You are currently in <strong>{currentLocation.name}</strong>
          </p>
        </div>

        <PassStatus
          pass={currentPass}
          currentLocation={currentLocation}
        />

        {!currentPass && (
          <CreatePassForm
            onCreatePass={handleCreatePass}
            isLoading={isLoading}
            excludeLocationId={currentLocation?.id}
            heading="Where to next?"
          />
        )}

        {currentPass &&
          currentPass.status === 'OPEN' &&
          (() => {
            const currentLeg = currentPass.legs[currentPass.legs.length - 1];
            if (!currentLeg) return null;
            
            if (currentLeg.state === 'IN') {
              return (
                <>
                  <Button
                    onClick={handleReturnToClass}
                    disabled={isLoading}
                    className="w-full mb-4 text-base font-semibold"
                    style={{ minHeight: 48 }}
                  >
                    {isLoading
                      ? 'Returning...'
                      : 'Return to Scheduled Class'}
                  </Button>
                  <CreatePassForm
                    onCreatePass={handleCreatePass}
                    isLoading={isLoading}
                    excludeLocationId={currentLeg.destinationLocationId}
                    heading="Need to go somewhere else?"
                  />
                </>
              );
            }
            
            if (currentLeg.state === 'OUT') {
              const {
                isRestroomTrip,
                returnLocationName,
                canArrive,
              } = actionState;
              
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isRestroomTrip && (
                      <Button
                        onClick={handleRestroomReturn}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading
                          ? 'Returning...'
                          : `I'm back in ${returnLocationName}`}
                      </Button>
                    )}
                    {!isRestroomTrip && (
                      <Button
                        onClick={handleClosePass}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading
                          ? 'Closing...'
                          : `I'm back in class`}
                      </Button>
                    )}
                    {canArrive && !isRestroomTrip && (
                      <div className="text-center pt-2">
                        <p className="text-sm text-muted-foreground mb-2">
                          Need to stay here for awhile?
                        </p>
                        <Button
                          onClick={handleReturn}
                          disabled={isLoading}
                          className="w-full"
                          variant="outline"
                        >
                          {isLoading
                            ? 'Updating...'
                            : "I've Arrived"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

        {currentPass && (
          <Card>
            <CardHeader>
              <CardTitle>Demo Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleResetPass}
                variant="outline"
                className="w-full"
              >
                Reset Pass (Demo Only)
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}