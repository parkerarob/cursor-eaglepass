"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/components/RoleProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signOut } from '@/lib/firebase/auth';
import { 
  getStudentById, 
  getLocationById, 
  getAllLocations,
  getAllPasses,
  getStudentsByAssignedLocation
} from '@/lib/firebase/firestore';
import { User, Pass, Location, Leg } from '@/types';
import { GlobalEmergencyBanner } from '@/components/GlobalEmergencyBanner';
import { NotificationService } from '@/lib/notificationService';
import { PassService } from '@/lib/passService';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PassWithDetails extends Pass {
  student?: User;
  legsWithDetails?: Array<{
    leg: Leg;
    originLocation?: Location;
    destinationLocation?: Location;
  }>;
  currentLocation?: Location;
  durationMinutes?: number;
  escalationStatus?: {
    isOverdue: boolean;
    shouldEscalate: boolean;
    notificationLevel: string;
  };
  teacherResponsibility?: 'origin' | 'destination' | 'both';
}

export default function TeacherPage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { currentUser: roleUser, isLoading: roleLoading } = useRole();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [passes, setPasses] = useState<PassWithDetails[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClosingPass, setIsClosingPass] = useState<string | null>(null);
  
  // Auto-refresh
  const autoRefresh = true;

  const fetchLocations = useCallback(async () => {
    try {
      const allLocations = await getAllLocations();
      setLocations(allLocations);
    } catch (e) {
      console.error('Failed to fetch locations:', e);
    }
  }, []);

  const fetchPassData = useCallback(async () => {
    if (!currentUser?.assignedLocationId) {
      setError('Teacher is not assigned to a classroom.');
      return;
    }

    try {
      // Fetch all passes from Firestore
      const allPasses = await getAllPasses();

      // Get students assigned to this teacher's classroom
      const assignedStudents = await getStudentsByAssignedLocation(currentUser.assignedLocationId);

      // Filter passes where teacher is responsible and pass is OPEN
      const teacherResponsiblePasses = allPasses.filter(pass => {
        if (pass.status !== 'OPEN') return false;
        
        // Teacher is responsible if:
        // 1. Student is assigned to teacher's classroom (origin responsibility)
        // 2. Student is headed to teacher's classroom (destination responsibility)
        const isOriginResponsible = assignedStudents.some(student => student.id === pass.studentId);
        const isDestinationResponsible = pass.legs.some(leg => 
          leg.destinationLocationId === currentUser.assignedLocationId
        );
        
        return isOriginResponsible || isDestinationResponsible;
      });

      // Enrich passes with details
      const enrichedPasses: PassWithDetails[] = await Promise.all(
        teacherResponsiblePasses.map(async (pass) => {
          const student = await getStudentById(pass.studentId);
          const legsWithDetails = await Promise.all(
            pass.legs.map(async (leg) => ({
              leg,
              originLocation: await getLocationById(leg.originLocationId),
              destinationLocation: await getLocationById(leg.destinationLocationId),
            }))
          );
          
          // Get current location based on last leg
          let currentLocation: Location | undefined;
          if (pass.legs.length > 0) {
            const lastLeg = pass.legs[pass.legs.length - 1];
            if (lastLeg.state === 'IN') {
              const location = await getLocationById(lastLeg.destinationLocationId);
              currentLocation = location || undefined;
            } else {
              const location = await getLocationById(lastLeg.originLocationId);
              currentLocation = location || undefined;
            }
          }

          // Calculate duration and escalation status
          const durationMinutes = NotificationService.calculateDuration(pass);
          const escalationStatus = NotificationService.getNotificationStatus(pass);

          // Determine teacher responsibility
          const isOriginResponsible = assignedStudents.some(student => student.id === pass.studentId);
          const isDestinationResponsible = pass.legs.some(leg => 
            leg.destinationLocationId === currentUser.assignedLocationId
          );
          
          let teacherResponsibility: 'origin' | 'destination' | 'both';
          if (isOriginResponsible && isDestinationResponsible) {
            teacherResponsibility = 'both';
          } else if (isOriginResponsible) {
            teacherResponsibility = 'origin';
          } else {
            teacherResponsibility = 'destination';
          }

          return {
            ...pass,
            student: student || undefined,
            legsWithDetails: legsWithDetails.map(legDetail => ({
              leg: legDetail.leg,
              originLocation: legDetail.originLocation || undefined,
              destinationLocation: legDetail.destinationLocation || undefined,
            })),
            currentLocation,
            durationMinutes,
            escalationStatus,
            teacherResponsibility,
          };
        })
      );
      setPasses(enrichedPasses);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchPassData();
    }
  }, [currentUser, fetchPassData]);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!authUser || !roleUser) {
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        // Only allow teachers to access this page
        if (roleUser?.role === 'teacher') {
          setCurrentUser(roleUser);
          await fetchLocations(); // fetchPassData is now called in a separate useEffect
        } else {
          setError(`Access denied. Your role (${roleUser?.role || 'unknown'}) does not have teacher privileges.`);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [authUser, roleUser, authLoading, roleLoading, fetchLocations]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !currentUser) return;

    const interval = setInterval(() => {
      fetchPassData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, currentUser, fetchPassData]);

  const handleClosePass = async (pass: PassWithDetails) => {
    if (!pass.student || !currentUser) return;
    
    setIsClosingPass(pass.id);
    try {
      const result = await PassService.closePass(pass, currentUser);
      if (result.success) {
        await fetchPassData(); // Refresh data
      } else {
        setError(result.error || 'Failed to close pass');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsClosingPass(null);
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const getStateBadge = (state: string) => {
    return state === 'IN' ? (
      <Badge className="bg-blue-100 text-blue-800">IN</Badge>
    ) : (
      <Badge className="bg-orange-100 text-orange-800">OUT</Badge>
    );
  };

  const getEscalationBadge = (pass: PassWithDetails) => {
    if (pass.escalationStatus?.isOverdue) {
      return <Badge className="bg-red-100 text-red-800">OVERDUE</Badge>;
    }
    if (pass.escalationStatus?.shouldEscalate) {
      return <Badge className="bg-orange-100 text-orange-800">ESCALATED</Badge>;
    }
    return null;
  };

  // Separate students into three groups for clarity
  const outFromMyClass = passes.filter(pass =>
    pass.teacherResponsibility === 'origin' &&
    pass.legs[pass.legs.length - 1]?.state === 'OUT'
  );

  const outToMyClass = passes.filter(pass =>
    pass.teacherResponsibility === 'destination' &&
    pass.legs[pass.legs.length - 1]?.state === 'OUT'
  );

  const inMyClass = passes.filter(pass => 
    pass.legs[pass.legs.length - 1]?.state === 'IN' && 
    (pass.teacherResponsibility === 'destination' || pass.teacherResponsibility === 'both')
  );

  if (isLoading || authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!authUser || !roleUser) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={signOut} variant="outline">Sign Out</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome, {currentUser?.name || currentUser?.email}
            </p>
            {currentUser?.assignedLocationId && (
              <p className="text-sm text-muted-foreground">
                Assigned to: {locations.find(l => l.id === currentUser.assignedLocationId)?.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </header>

        <GlobalEmergencyBanner />

        {/* Students OUT - From My Class */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Students OUT - From My Class ({outFromMyClass.length})</CardTitle>
              <Button onClick={fetchPassData} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {outFromMyClass.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students are currently out from your class.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Student</th>
                      <th className="text-left p-2">Current Location</th>
                      <th className="text-left p-2">Destination</th>
                      <th className="text-left p-2">Duration</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outFromMyClass.map((pass) => (
                      <tr key={pass.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{pass.student?.name || 'Unknown Student'}</div>
                            <div className="text-sm text-muted-foreground">{pass.student?.email}</div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span>{pass.currentLocation?.name || 'Unknown'}</span>
                            {getStateBadge('OUT')}
                          </div>
                        </td>
                        <td className="p-2">
                          {pass.legsWithDetails && pass.legsWithDetails.length > 0 ?
                            pass.legsWithDetails[pass.legsWithDetails.length - 1].destinationLocation?.name : 'Unknown'
                          }
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{formatDuration(pass.durationMinutes || 0)}</span>
                            {getEscalationBadge(pass)}
                          </div>
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {formatDate(pass.createdAt)}<br />
                          {formatTime(pass.createdAt)}
                        </td>
                        <td className="p-2">
                          <Button
                            onClick={() => handleClosePass(pass)}
                            disabled={isClosingPass === pass.id}
                            variant="outline"
                            size="sm"
                          >
                            {isClosingPass === pass.id ? 'Closing...' : 'Close Pass'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Students OUT - En Route to My Class */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Students OUT - En Route To My Class ({outToMyClass.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {outToMyClass.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students are currently en route to your classroom.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Student</th>
                      <th className="text-left p-2">From</th>
                      <th className="text-left p-2">Duration</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outToMyClass.map((pass) => (
                      <tr key={pass.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{pass.student?.name || 'Unknown Student'}</div>
                            <div className="text-sm text-muted-foreground">{pass.student?.email}</div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span>{pass.currentLocation?.name || 'Unknown'}</span>
                             {getStateBadge('OUT')}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{formatDuration(pass.durationMinutes || 0)}</span>
                            {getEscalationBadge(pass)}
                          </div>
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {formatDate(pass.createdAt)}<br />
                          {formatTime(pass.createdAt)}
                        </td>
                        <td className="p-2">
                           <Button
                            onClick={() => handleClosePass(pass)}
                            disabled={isClosingPass === pass.id}
                            variant="outline"
                            size="sm"
                          >
                            {isClosingPass === pass.id ? 'Closing...' : 'Close Pass'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Students IN (non-origin) */}
        <Card>
          <CardHeader>
            <CardTitle>Students IN - Visiting My Class ({inMyClass.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {inMyClass.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students are currently visiting your classroom.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Student</th>
                      <th className="text-left p-2">From</th>
                      <th className="text-left p-2">Arrived</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inMyClass.map((pass) => (
                      <tr key={pass.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{pass.student?.name || 'Unknown Student'}</div>
                            <div className="text-sm text-muted-foreground">{pass.student?.email}</div>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span>{pass.legs[0]?.originLocationId ? 
                              locations.find(l => l.id === pass.legs[0].originLocationId)?.name : 'Unknown'}</span>
                            {getStateBadge('IN')}
                          </div>
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {pass.legs.length > 0 && pass.legs[pass.legs.length - 1]?.timestamp ? 
                            formatTime(pass.legs[pass.legs.length - 1].timestamp) : 'Unknown'}
                        </td>
                        <td className="p-2">
                          <Button
                            onClick={() => handleClosePass(pass)}
                            disabled={isClosingPass === pass.id}
                            variant="outline"
                            size="sm"
                          >
                            {isClosingPass === pass.id ? 'Closing...' : 'Close Pass'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}