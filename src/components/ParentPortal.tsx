'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

interface ParentRelationship {
  id: string;
  parentId: string;
  parentEmail: string;
  studentId: string;
  studentName: string;
  relationshipType: 'parent' | 'guardian' | 'authorized_representative';
  verifiedAt: Date;
  active: boolean;
}

export default function ParentPortal() {
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  const [relationships, setRelationships] = useState<ParentRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFerpaNotice, setShowFerpaNotice] = useState(true);
  const [directoryOptOuts, setDirectoryOptOuts] = useState<Record<string, boolean>>({
    name: false,
    gradeLevel: false,
    datesOfAttendance: false,
    activitiesParticipation: false,
    degreesHonorsAwards: false,
    photo: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // For demo purposes, using a mock parent ID
      // In production, this would come from authentication
      const mockParentId = 'parent-1';
      
      // Load parent relationships
      const relationshipsResponse = await fetch(`/api/parent/relationships?parentId=${mockParentId}`);
      if (relationshipsResponse.ok) {
        const data = await relationshipsResponse.json();
        setRelationships(data.relationships || []);
      }
      
      // Load student records for verified relationships
      const verifiedStudents = relationships.filter(rel => rel.active);
      const records: StudentRecord[] = [];
      
      for (const relationship of verifiedStudents) {
        // In production, this would fetch real pass data
        const mockPasses: Pass[] = [
          {
            id: 'pass-1',
            studentName: relationship.studentName,
            destination: 'Restroom',
            issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            returnedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
            status: 'returned',
            teacher: 'Ms. Smith'
          }
        ];
        
        records.push({
          id: relationship.studentId,
          studentName: relationship.studentName,
          passes: mockPasses,
          lastAccessed: new Date()
        });
      }
      
      setStudentRecords(records);
      
    } catch (error) {
      console.error('Error loading parent portal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectoryOptOutChange = async (infoType: string, optedOut: boolean) => {
    try {
      const mockParentId = 'parent-1';
      const mockStudentId = 'student-00001';
      const mockStudentName = 'Emma Johnson';
      
      const optOutItems = optedOut ? [infoType] : [];
      
      const response = await fetch('/api/parent/directory-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentId: mockParentId,
          studentId: mockStudentId,
          studentName: mockStudentName,
          optOutItems
        }),
      });
      
      if (response.ok) {
        setDirectoryOptOuts(prev => ({
          ...prev,
          [infoType]: optedOut
        }));
      }
    } catch (error) {
      console.error('Error updating directory information opt-out:', error);
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
          <TabsTrigger value="relationships">Parent Relationships</TabsTrigger>
          <TabsTrigger value="directory">Directory Information</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          {studentRecords.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No student records available.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  You need to have a verified parent-student relationship to access records.
                </p>
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

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parent-Student Relationships</CardTitle>
              <CardDescription>Your verified relationships with students</CardDescription>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <div className="text-center p-6">
                  <p className="text-muted-foreground mb-4">
                    No verified parent-student relationships found.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Contact school administration to establish a parent-student relationship.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {relationships.map((relationship) => (
                    <div key={relationship.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{relationship.studentName}</div>
                        <div className="text-sm text-muted-foreground">
                          Relationship: {relationship.relationshipType}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Verified: {formatDateTime(relationship.verifiedAt)}
                        </div>
                      </div>
                      <Badge className={relationship.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {relationship.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Directory Information Opt-Out</CardTitle>
              <CardDescription>Control what directory information can be shared about your child</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Directory information may be disclosed without prior consent unless you opt out. 
                  Toggle the switches below to opt out of specific types of directory information.
                </p>
                
                <div className="space-y-3">
                  {Object.entries(directoryOptOuts).map(([infoType, optedOut]) => (
                    <div key={infoType} className="flex items-center justify-between">
                      <Label htmlFor={infoType} className="flex-1">
                        {infoType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </Label>
                      <Switch
                        id={infoType}
                        checked={optedOut}
                        onCheckedChange={(checked) => handleDirectoryOptOutChange(infoType, checked)}
                      />
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Opt-out preferences are applied per student and school year. 
                    You may need to renew these preferences annually.
                  </p>
                </div>
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