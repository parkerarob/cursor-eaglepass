'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StudentRecord {
  id: string;
  studentName: string;
  passes: Pass[];
  lastAccessed: Date;
}

interface Pass {
  id: string;
  studentName: string;
  destination: string;
  issuedAt: Date;
  returnedAt?: Date;
  status: 'active' | 'returned' | 'expired';
  teacher: string;
}

export default function ParentPortal() {
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  // const [accessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFerpaNotice, setShowFerpaNotice] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Mock data for demonstration
      const mockRecords: StudentRecord[] = [
        {
          id: 'student-1',
          studentName: 'Emma Johnson',
          passes: [
            {
              id: 'pass-1',
              studentName: 'Emma Johnson',
              destination: 'Restroom',
              issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
              returnedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
              status: 'returned',
              teacher: 'Ms. Smith'
            }
          ],
          lastAccessed: new Date()
        }
      ];
      
      setStudentRecords(mockRecords);
      
    } catch (error) {
      console.error('Error loading student records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'returned':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'active':
        return 'bg-yellow-100 text-yellow-800';
      case 'denied':
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div>Loading student records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Parent Portal</h1>
      </div>

      {showFerpaNotice && (
        <Alert>
          <AlertDescription>
            <div className="flex justify-between items-start">
              <div className="flex-1 pr-4">
                <strong>FERPA Rights Notice:</strong> You have the right to inspect and review your child&apos;s educational records. 
                These records are protected under FERPA and access is logged for compliance purposes.
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFerpaNotice(false)}
              >
                ×
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Student Records</TabsTrigger>
          <TabsTrigger value="requests">Access Requests</TabsTrigger>
          <TabsTrigger value="directory">Directory Information</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          {studentRecords.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No student records available.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {studentRecords.map((record) => (
                <Card key={record.id}>
                  <CardHeader>
                    <CardTitle>Hall Passes - {record.studentName}</CardTitle>
                    <CardDescription>Recent hall pass activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {record.passes.length === 0 ? (
                      <p className="text-muted-foreground">No hall passes recorded.</p>
                    ) : (
                      <div className="space-y-3">
                        {record.passes.map((pass) => (
                          <div key={pass.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{pass.destination}</span>
                                <Badge className={getStatusBadgeColor(pass.status)}>
                                  {pass.status}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Issued: {formatDateTime(pass.issuedAt)}
                                {pass.returnedAt && (
                                  <> • Returned: {formatDateTime(pass.returnedAt)}</>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Teacher: {pass.teacher}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Requests</CardTitle>
              <CardDescription>Your requests to access educational records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6">
                <p className="text-muted-foreground mb-4">
                  Request access to your child&apos;s educational records.
                </p>
                <Button variant="outline" disabled>
                  Request Record Access
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Directory Information</CardTitle>
              <CardDescription>Manage directory information opt-out preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6">
                <p className="text-muted-foreground mb-4">
                  Control what directory information can be shared about your child.
                </p>
                <Button variant="outline" disabled>
                  Manage Directory Information
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* FERPA Notice */}
      <Card>
        <CardHeader>
          <CardTitle>FERPA Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Your Rights Under FERPA:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Inspect and review your child&apos;s educational records</li>
              <li>Request corrections to records you believe are inaccurate or misleading</li>
              <li>Have some control over the disclosure of personally identifiable information</li>
              <li>File a complaint with the U.S. Department of Education if you believe your rights have been violated</li>
            </ul>
            <p className="mt-3">
              All access to your child&apos;s records is logged for compliance purposes. 
              For questions about your FERPA rights, please contact the school administration.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 