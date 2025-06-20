'use client';

import { useState } from 'react';
import { Pass, User, Location, PassFormData, Leg } from '@/types';
import { PassStatus } from '@/components/PassStatus';
import { CreatePassForm } from '@/components/CreatePassForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getLocationById, 
  getActivePassByStudentId,
  mockUsers
} from '@/lib/mockData';

export default function Home() {
  // For demo purposes, we'll simulate being logged in as the first student
  const currentStudent = mockUsers.find(u => u.role === 'student') as User;
  const currentLocation = getLocationById(currentStudent.assignedLocationId!) as Location;
  const [currentPass, setCurrentPass] = useState<Pass | null>(
    getActivePassByStudentId(currentStudent.id) || null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Helper to get the current leg
  const getCurrentLeg = (pass: Pass | null): Leg | null => {
    if (!pass || pass.legs.length === 0) return null;
    return pass.legs[pass.legs.length - 1];
  };

  // Helper to get the next leg number
  const getNextLegNumber = (pass: Pass | null): number => {
    if (!pass) return 1;
    return pass.legs.length + 1;
  };

  // Helper to find the last non-restroom location
  const getLastNonRestroomLocationId = (pass: Pass): string => {
    for (let i = pass.legs.length - 1; i >= 0; i--) {
      const leg = pass.legs[i];
      if (getLocationById(leg.destinationLocationId)?.locationType !== 'bathroom') {
        return leg.destinationLocationId;
      }
    }
    // Fallback to scheduled class if none found
    return currentStudent.assignedLocationId!;
  };

  const handleCreatePass = async (formData: PassFormData) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    setCurrentPass(newPass);
    setIsLoading(false);
  };

  const handleReturn = async () => {
    if (!currentPass) return;
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const lastLeg = getCurrentLeg(currentPass)!;
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
    setCurrentPass(updatedPass);
    setIsLoading(false);
  };

  const handleReturnToClass = async () => {
    if (!currentPass) return;
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const lastLeg = getCurrentLeg(currentPass)!;
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
    setCurrentPass(updatedPass);
    setIsLoading(false);
  };

  const handleClosePass = async () => {
    if (!currentPass) return;
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const lastLeg = getCurrentLeg(currentPass)!;
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
    setCurrentPass(closedPass);
    setIsLoading(false);
    setTimeout(() => {
      setCurrentPass(null);
    }, 1500);
  };

  const handleResetPass = () => {
    setCurrentPass(null);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Eagle Pass</h1>
          <p className="text-muted-foreground">
            Welcome, {currentStudent.name} • Currently in {currentLocation.name}
          </p>
        </div>

        {/* Current Status */}
        <PassStatus 
          pass={currentPass} 
          studentName={currentStudent.name}
          currentLocation={currentLocation}
        />

        {/* Create New Pass - Only show when no active pass */}
        {!currentPass && (
          <CreatePassForm 
            onCreatePass={handleCreatePass}
            isLoading={isLoading}
          />
        )}

        {/* When pass is OPEN and last leg is IN, show all destination buttons and Return to Scheduled Class */}
        {currentPass && currentPass.status === 'OPEN' && (() => {
          const currentLeg = getCurrentLeg(currentPass);
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
                  onCreatePass={async (formData) => {
                    setIsLoading(true);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const newLeg: Leg = {
                      legNumber: getNextLegNumber(currentPass),
                      originLocationId: currentLeg.destinationLocationId,
                      destinationLocationId: formData.destinationLocationId,
                      state: 'OUT',
                      timestamp: new Date(),
                    };
                    const updatedPass: Pass = {
                      ...currentPass,
                      lastUpdatedAt: new Date(),
                      legs: [...currentPass.legs, newLeg],
                    };
                    setCurrentPass(updatedPass);
                    setIsLoading(false);
                  }}
                  isLoading={isLoading}
                  excludeLocationId={currentLeg.destinationLocationId}
                  heading="Need to go somewhere else?"
                />
              </>
            );
          }
          if (currentLeg.state === 'OUT') {
            const isRestroomTrip = getLocationById(currentLeg.destinationLocationId)?.locationType === 'bathroom';
            let returnLocationId = isRestroomTrip
              ? getLastNonRestroomLocationId(currentPass)
              : currentStudent.assignedLocationId;
            if (!returnLocationId) returnLocationId = currentStudent.assignedLocationId!;
            const returnLocationName = getLocationById(returnLocationId)?.name ?? 'class';
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
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const newLeg: Leg = {
                          legNumber: getNextLegNumber(currentPass),
                          originLocationId: currentLeg.destinationLocationId!,
                          destinationLocationId: returnLocationId!,
                          state: 'IN',
                          timestamp: new Date(),
                        };
                        const updatedPass: Pass = {
                          ...currentPass,
                          lastUpdatedAt: new Date(),
                          legs: [...currentPass.legs, newLeg],
                        };
                        setCurrentPass(updatedPass);
                        setIsLoading(false);
                      }}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Returning...' : `I'm back in ${returnLocationName}`}
                    </Button>
                  )}
                  {!isRestroomTrip && (getLocationById(currentLeg.destinationLocationId)?.locationType === 'bathroom' ||
                    currentLeg.destinationLocationId === currentStudent.assignedLocationId) && (
                    <Button
                      onClick={handleClosePass}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Closing...' : `I'm back in class`}
                    </Button>
                  )}
                  {getLocationById(currentLeg.destinationLocationId)?.locationType !== 'bathroom' &&
                    currentLeg.destinationLocationId !== currentStudent.assignedLocationId && !isRestroomTrip && (
                      <>
                        <Button
                          onClick={handleClosePass}
                          disabled={isLoading}
                          className="w-full"
                        >
                          {isLoading ? 'Closing...' : `I'm back in class`}
                        </Button>
                        <div className="text-center pt-2">
                          <p className="text-sm text-muted-foreground mb-2">Need to stay here for awhile?</p>
                          <Button
                            onClick={handleReturn}
                            disabled={isLoading}
                            className="w-full"
                            variant="outline"
                          >
                            {isLoading ? 'Updating...' : 'I\'ve Arrived'}
                          </Button>
                        </div>
                      </>
                    )}
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* Reset Button for Demo */}
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
