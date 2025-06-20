'use client';

import { useState } from 'react';
import { Pass, User, Location, PassFormData } from '@/types';
import { PassStatus } from '@/components/PassStatus';
import { CreatePassForm } from '@/components/CreatePassForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  getStudentById, 
  getLocationById, 
  getActivePassByStudentId,
  mockUsers,
  mockLocations,
  mockPasses
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Eagle Pass</h1>
          <p className="text-muted-foreground">
            Welcome, {currentStudent.name} • Currently in {currentLocation.name}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Student Actions */}
          <div className="space-y-6">
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
                    <Button 
                      onClick={handleReturn} 
                      disabled={isLoading}
                      className="w-full"
                      variant="outline"
                    >
                      {isLoading ? 'Updating...' : 'I\'ve Arrived'}
                    </Button>
                  )}
                  
                  {currentPass.state === 'IN' && (
                    <Button 
                      onClick={handleClosePass} 
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Closing...' : 'Return to Class'}
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
          </div>

          {/* Right Column - Class Overview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Class Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockUsers
                    .filter(user => user.role === 'student' && user.assignedLocationId === currentLocation.id)
                    .map(student => {
                      const studentPass = getActivePassByStudentId(student.id);
                      const isCurrentUser = student.id === currentStudent.id;
                      
                      return (
                        <div 
                          key={student.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-card'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">
                              {student.name}
                              {isCurrentUser && ' (You)'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {studentPass ? (
                              <>
                                <Badge variant={studentPass.state === 'OUT' ? 'warning' : 'info'}>
                                  {studentPass.state}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {getLocationById(studentPass.destinationLocationId)?.name}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="success">IN CLASS</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {mockUsers.filter(u => u.role === 'student' && u.assignedLocationId === currentLocation.id).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Students in Class</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">
                      {mockUsers
                        .filter(u => u.role === 'student' && u.assignedLocationId === currentLocation.id)
                        .filter(student => {
                          const pass = getActivePassByStudentId(student.id);
                          return pass && pass.state === 'OUT';
                        }).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Currently Out</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
