'use client';

import { useState, useEffect } from 'react';
import { Pass, User, Location, PassFormData, Leg } from '@/types';
import { PassStatus } from '@/components/PassStatus';
import { CreatePassForm } from '@/components/CreatePassForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getLocationById,
  getActivePassByStudentId,
  getStudentById,
  createPass,
  updatePass,
} from '@/lib/firebase/firestore';

export default function Home() {
  const currentStudentId = 'student-1';

  const [currentStudent, setCurrentStudent] = useState<User | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentPass, setCurrentPass] = useState<Pass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionState, setActionState] = useState({
    isRestroomTrip: false,
    isSimpleTrip: false,
    returnLocationName: 'class',
    canArrive: false,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const student = await getStudentById(currentStudentId);

        if (!student) {
          throw new Error(`Student with ID '${currentStudentId}' not found in the database.`);
        }
        
        if (!student.assignedLocationId) {
          throw new Error(`Student with ID '${currentStudentId}' is missing an assignedLocationId.`);
        }

        const [location, pass] = await Promise.all([
          getLocationById(student.assignedLocationId),
          getActivePassByStudentId(student.id)
        ]);

        if (!location) {
          throw new Error(`Could not find assigned location for student '${currentStudentId}'. Check if a location with ID '${student.assignedLocationId}' exists.`);
        }

        setCurrentStudent(student);
        setCurrentLocation(location);
        setCurrentPass(pass);

      } catch (e) {
        const err = e as Error;
        console.error("Failed to fetch initial data:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [currentStudentId]);

  useEffect(() => {
    if (!currentPass || !currentStudent) {
      return;
    }

    const determineActionState = async () => {
      const lastLeg = currentPass.legs[currentPass.legs.length - 1];
      if (lastLeg.state !== 'OUT') return;

      const destination = await getLocationById(lastLeg.destinationLocationId);
      const isRestroom = destination?.locationType === 'bathroom';
      const isSimple = currentPass.legs.length === 1 && isRestroom;

      let returnLocName = 'class';
      if (isRestroom && !isSimple) {
        let returnId: string | undefined;
        for (let i = currentPass.legs.length - 2; i >= 0; i--) {
            const leg = currentPass.legs[i];
            const loc = await getLocationById(leg.destinationLocationId);
            if (loc?.locationType !== 'bathroom') {
                returnId = leg.destinationLocationId;
                break;
            }
        }
        if (!returnId) returnId = currentStudent.assignedLocationId;
        const returnLocation = await getLocationById(returnId!);
        returnLocName = returnLocation?.name ?? 'class';
      }

      const canArrive = destination?.locationType !== 'bathroom' &&
                        lastLeg.destinationLocationId !== currentStudent.assignedLocationId;

      setActionState({
        isRestroomTrip: isRestroom,
        isSimpleTrip: isSimple,
        returnLocationName: returnLocName,
        canArrive: canArrive,
      });
    };

    determineActionState();
  }, [currentPass, currentStudent]);

  const getNextLegNumber = (pass: Pass | null): number => {
    if (!pass) return 1;
    return pass.legs.length + 1;
  };

  const handleCreatePass = async (formData: PassFormData) => {
    if (!currentStudent) return;
    setIsLoading(true);
    const newPass: Pass = {
      id: `pass-${Date.now()}`,
      studentId: currentStudent.id,
      status: 'OPEN',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      legs: [
        {
          legNumber: 1,
          originLocationId: currentStudent.assignedLocationId!,
          destinationLocationId: formData.destinationLocationId,
          state: 'OUT',
          timestamp: new Date(),
        },
      ],
    };
    await createPass(newPass);
    setCurrentPass(newPass);
    setIsLoading(false);
  };

  const handleReturn = async () => {
    if (!currentPass) return;
    setIsLoading(true);
    const lastLeg = currentPass.legs[currentPass.legs.length - 1];
    const newLeg: Leg = {
      legNumber: getNextLegNumber(currentPass),
      originLocationId: lastLeg.destinationLocationId,
      destinationLocationId: lastLeg.destinationLocationId,
      state: 'IN',
      timestamp: new Date(),
    };
    const updatedPass: Pass = {
      ...currentPass,
      lastUpdatedAt: new Date(),
      legs: [...currentPass.legs, newLeg],
    };
    await updatePass(updatedPass.id, updatedPass);
    setCurrentPass(updatedPass);
    setIsLoading(false);
  };

  const handleReturnToClass = async () => {
    if (!currentPass || !currentStudent) return;
    setIsLoading(true);
    const lastLeg = currentPass.legs[currentPass.legs.length - 1];
    const newLeg: Leg = {
      legNumber: getNextLegNumber(currentPass),
      originLocationId: lastLeg.destinationLocationId,
      destinationLocationId: currentStudent.assignedLocationId!,
      state: 'OUT',
      timestamp: new Date(),
    };
    const updatedPass: Pass = {
      ...currentPass,
      lastUpdatedAt: new Date(),
      legs: [...currentPass.legs, newLeg],
    };
    await updatePass(updatedPass.id, updatedPass);
    setCurrentPass(updatedPass);
    setIsLoading(false);
  };

  const handleClosePass = async () => {
    if (!currentPass || !currentStudent) return;
    setIsLoading(true);
    const lastLeg = currentPass.legs[currentPass.legs.length - 1];
    const newLeg: Leg = {
      legNumber: getNextLegNumber(currentPass),
      originLocationId: lastLeg.destinationLocationId,
      destinationLocationId: currentStudent.assignedLocationId!,
      state: 'IN',
      timestamp: new Date(),
    };
    const closedPass: Pass = {
      ...currentPass,
      status: 'CLOSED',
      lastUpdatedAt: new Date(),
      legs: [...currentPass.legs, newLeg],
    };
    await updatePass(closedPass.id, closedPass);
    setCurrentPass(closedPass);
    setIsLoading(false);
    setTimeout(() => {
      setCurrentPass(null);
    }, 1500);
  };

  const handleResetPass = () => {
    setCurrentPass(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Could Not Load App</h1>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground mt-4">
          Please check the data in your Firestore database and ensure it's correct.
        </p>
      </div>
    );
  }

  if (!currentStudent || !currentLocation) {
    // This case should ideally not be reached if error handling is exhaustive
    return (
        <div className="min-h-screen bg-background p-4 flex items-center justify-center">
            <p>An unknown error occurred while loading student data.</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <ThemeToggle />
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Eagle Pass</h1>
          <p className="text-muted-foreground">
            Welcome, {currentStudent.name} • Currently in {currentLocation.name}
          </p>
        </div>

        <PassStatus
          pass={currentPass}
          studentName={currentStudent.name}
          currentLocation={currentLocation}
        />

        {!currentPass && (
          <CreatePassForm
            onCreatePass={handleCreatePass}
            isLoading={isLoading}
          />
        )}

        {currentPass && currentPass.status === 'OPEN' && (() => {
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
                  {isLoading ? 'Returning...' : 'Return to Scheduled Class'}
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
            const { isRestroomTrip, isSimpleTrip, returnLocationName, canArrive } = actionState;
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isRestroomTrip && (
                    <Button
                      onClick={async () => {
                        setIsLoading(true);
                        if (isSimpleTrip) {
                          const newLeg: Leg = {
                            legNumber: getNextLegNumber(currentPass),
                            originLocationId: currentLeg.destinationLocationId!,
                            destinationLocationId: currentStudent.assignedLocationId!,
                            state: 'IN',
                            timestamp: new Date(),
                          };
                          const closedPass: Pass = {
                            ...currentPass,
                            status: 'CLOSED',
                            lastUpdatedAt: new Date(),
                            legs: [...currentPass.legs, newLeg],
                          };
                          await updatePass(closedPass.id, closedPass);
                          setCurrentPass(closedPass);
                          setTimeout(() => {
                            setCurrentPass(null);
                          }, 1500);
                        } else {
                           let returnId: string | undefined;
                           for (let i = currentPass.legs.length - 2; i >= 0; i--) {
                               const leg = currentPass.legs[i];
                               const loc = await getLocationById(leg.destinationLocationId);
                               if (loc?.locationType !== 'bathroom') {
                                   returnId = leg.destinationLocationId;
                                   break;
                               }
                           }
                           if (!returnId) returnId = currentStudent.assignedLocationId;

                          const newLeg: Leg = {
                            legNumber: getNextLegNumber(currentPass),
                            originLocationId: currentLeg.destinationLocationId!,
                            destinationLocationId: returnId!,
                            state: 'IN',
                            timestamp: new Date(),
                          };
                          const updatedPass: Pass = {
                            ...currentPass,
                            lastUpdatedAt: new Date(),
                            legs: [...currentPass.legs, newLeg],
                          };
                          await updatePass(updatedPass.id, updatedPass);
                          setCurrentPass(updatedPass);
                        }
                        setIsLoading(false);
                      }}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Returning...' : `I'm back in ${isSimpleTrip ? 'class' : returnLocationName}`}
                    </Button>
                  )}
                  {!isRestroomTrip && (
                      <Button
                        onClick={handleClosePass}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading ? 'Closing...' : `I'm back in class`}
                      </Button>
                  )}
                  {canArrive && !isRestroomTrip && (
                      <div className="text-center pt-2">
                        <p className="text-sm text-muted-foreground mb-2">Need to stay here for awhile?</p>
                        <Button
                          onClick={handleReturn}
                          disabled={isLoading}
                          className="w-full"
                          variant="outline"
                        >
                          {isLoading ? 'Updating...' : "I've Arrived"}
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