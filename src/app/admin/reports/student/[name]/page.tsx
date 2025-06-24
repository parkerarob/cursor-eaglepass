'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Calendar, User, MapPin, FileText, Navigation } from 'lucide-react';
import { getPassesByStudentName, getLocationById, getUserById } from '@/lib/firebase/firestore';
import { Pass, Location, User as UserType, Leg } from '@/types';

interface LegWithDetails extends Leg {
  originLocation?: Location;
  destinationLocation?: Location;
}

interface PassWithDetails extends Pass {
  student?: UserType;
  currentDestination?: Location;
  durationMinutes?: number;
  teacherName?: string;
  legsWithDetails?: LegWithDetails[];
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentName = decodeURIComponent(params.name as string);
  
  const [passes, setPasses] = useState<PassWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPass, setSelectedPass] = useState<PassWithDetails | null>(null);

  useEffect(() => {
    const loadPasses = async () => {
      try {
        const studentPasses = await getPassesByStudentName(studentName);
        
        const enrichedPasses = await Promise.all(
          studentPasses.map(async (pass) => {
            const student = await getUserById(pass.studentId);
            
            let currentDestination: Location | undefined;
            if (pass.legs.length > 0) {
              const lastLeg = pass.legs[pass.legs.length - 1];
              const location = await getLocationById(lastLeg.state === 'IN' ? lastLeg.destinationLocationId : lastLeg.originLocationId);
              currentDestination = location || undefined;
            }
            
            const legsWithDetails = await Promise.all(pass.legs.map(async (leg) => {
              const [originLocation, destinationLocation] = await Promise.all([
                  getLocationById(leg.originLocationId),
                  getLocationById(leg.destinationLocationId)
              ]);
              return {
                  ...leg,
                  originLocation: originLocation || undefined,
                  destinationLocation: destinationLocation || undefined,
              };
            }));

            return {
              ...pass,
              student: student || undefined,
              currentDestination,
              durationMinutes: pass.durationMinutes || 0,
              teacherName: 'Teacher', 
              legsWithDetails,
            };
          })
        );
        
        setPasses(enrichedPasses);
      } catch (error) {
        console.error('Error loading passes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPasses();
  }, [studentName]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePassClick = (pass: PassWithDetails) => {
    setSelectedPass(pass);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading student data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <User className="h-8 w-8" />
              {studentName}
            </h1>
            <p className="text-muted-foreground">
              {passes.length} total passes
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Passes List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <FileText data-testid="reports-icon-summary" className="w-5 h-5" />
                Pass History
              </CardTitle>
              <CardDescription>
                Click on any pass to view detailed information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {passes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No passes found for this student</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {passes.map((pass) => (
                    <div
                      key={pass.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedPass?.id === pass.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => handlePassClick(pass)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(pass.status)}>
                            {pass.status}
                          </Badge>
                          <span className="font-medium">
                            {pass.currentDestination?.name || 'Unknown Location'}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(pass.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock data-testid="clock-icon-duration" className="w-4 h-4" />
                          {pass.durationMinutes || 0} min
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {pass.teacherName || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pass Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <FileText data-testid="reports-icon-details" className="w-5 h-5" />
                Pass Details
              </CardTitle>
              <CardDescription>
                {selectedPass ? 'Detailed information about the selected pass' : 'Select a pass to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedPass ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div className="mt-1">
                        <Badge className={getStatusColor(selectedPass.status)}>
                          {selectedPass.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Duration</label>
                      <div className="mt-1 flex items-center gap-1">
                        <Clock data-testid="clock-icon-details" className="w-4 h-4" />
                        {selectedPass.durationMinutes || 0} minutes
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Location</label>
                    <div className="mt-1 flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {selectedPass.currentDestination?.name || 'Unknown Location'}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Student</label>
                    <div className="mt-1 flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedPass.student?.name || 'Unknown Student'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created</label>
                      <div className="mt-1 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(selectedPass.createdAt)}
                      </div>
                    </div>
                    {selectedPass.closedAt && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Closed</label>
                        <div className="mt-1 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(selectedPass.closedAt)}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Navigation className="h-4 w-4" />
                      Pass Journey
                    </label>
                    <div className="mt-2 space-y-3">
                      {selectedPass.legsWithDetails?.map((legDetail, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm">
                          <div className="flex items-center justify-between font-medium">
                            <span className="flex items-center gap-2">
                              {legDetail.state === 'OUT' ? 'Departed' : 'Arrived'}
                            </span>
                            <Badge variant="outline">{legDetail.state}</Badge>
                          </div>
                          <div className="text-muted-foreground mt-2 space-y-1">
                            <p><span className="font-semibold">From:</span> {legDetail.originLocation?.name || 'Unknown'}</p>
                            <p><span className="font-semibold">To:</span> {legDetail.destinationLocation?.name || 'Unknown'}</p>
                          </div>
                          <div className="text-xs text-muted-foreground/80 mt-2 text-right">
                            {new Date(legDetail.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText data-testid="reports-icon-empty" className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a pass from the list to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 