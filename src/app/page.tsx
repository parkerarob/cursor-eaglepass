'use client';

import { useState } from 'react';
import { Pass, User, Location, PassFormData } from '@/types';
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

  const handleCreatePass = async (formData: PassFormData) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a new pass (in real app, this would be saved to database)
    const newPass: Pass = {
      id: `pass-${Date.now()}`,
      studentId: currentStudent.id,
      originLocationId: currentStudent.assignedLocationId!,
      destinationLocationId: formData.destinationLocationId,
      status: 'OPEN',
      state: 'OUT',
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    };
    
    setCurrentPass(newPass);
    setIsLoading(false);
  };

  const handleReturn = async () => {
    if (!currentPass) return;
    
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update pass to show student has returned
    const updatedPass: Pass = {
      ...currentPass,
      state: 'IN',
      lastUpdatedAt: new Date(),
    };
    
    setCurrentPass(updatedPass);
    setIsLoading(false);
  };

  const handleClosePass = async () => {
    if (!currentPass) return;
    
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close the pass
    const closedPass: Pass = {
      ...currentPass,
      status: 'CLOSED',
      lastUpdatedAt: new Date(),
    };
    
    setCurrentPass(closedPass);
    setIsLoading(false);
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

        {/* Action Buttons */}
        {currentPass && currentPass.status === 'OPEN' && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentPass.state === 'OUT' && (
                <>
                  <Button 
                    onClick={handleReturn} 
                    disabled={isLoading}
                    className="w-full"
                    variant="outline"
                  >
                    {isLoading ? 'Updating...' : 'I\'ve Arrived'}
                  </Button>
                  <Button 
                    onClick={handleClosePass} 
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Closing...' : 'I\'m back in class'}
                  </Button>
                </>
              )}
              
              {currentPass.state === 'IN' && (
                <Button 
                  onClick={handleClosePass} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Closing...' : 'I\'m back in class'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create New Pass */}
        {!currentPass && (
          <CreatePassForm 
            onCreatePass={handleCreatePass}
            isLoading={isLoading}
          />
        )}

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
