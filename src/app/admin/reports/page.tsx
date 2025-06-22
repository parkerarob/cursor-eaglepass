"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/components/RoleProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signOut } from '@/lib/firebase/auth';
import { 
  getAllPasses,
  getAllStudents,
  getAllLocations,
  getUserById,
  getLocationById,
} from '@/lib/firebase/firestore';
import { User, Pass, Location, Leg } from '@/types';
import { GlobalEmergencyBanner } from '@/components/GlobalEmergencyBanner';
import { ReportingDashboard } from '@/components/ReportingDashboard';
import { NotificationService } from '@/lib/notificationService';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, TrendingUp, Users, Building } from 'lucide-react';

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
}

export default function AdminReportsPage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { currentUser: roleUser, isLoading: roleLoading } = useRole();
  const [passes, setPasses] = useState<PassWithDetails[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // Fetch all data in parallel
      const [allPasses, allStudents, allLocations] = await Promise.all([
        getAllPasses(),
        getAllStudents(),
        getAllLocations(),
      ]);

      // Enrich passes with details
      const enrichedPasses: PassWithDetails[] = await Promise.all(
        allPasses.map(async (pass) => {
          const student = await getUserById(pass.studentId);
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
          };
        })
      );

      setPasses(enrichedPasses);
      setStudents(allStudents);
      setLocations(allLocations);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!authUser || !roleUser) {
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        if (roleUser?.role === 'admin') {
          await fetchData();
        } else {
          setError(`Access denied. Your role (${roleUser?.role || 'unknown'}) does not have admin privileges.`);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    };

    fetchUserData();
  }, [authUser, roleUser, authLoading, roleLoading]);

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
      day: 'numeric',
      year: 'numeric'
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
    switch (state) {
      case 'IN':
        return <Badge className="bg-green-100 text-green-800">IN</Badge>;
      case 'OUT':
        return <Badge className="bg-orange-100 text-orange-800">OUT</Badge>;
      case 'CLOSED':
        return <Badge className="bg-gray-100 text-gray-800">CLOSED</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const getEscalationBadge = (pass: PassWithDetails) => {
    if (!pass.escalationStatus) return null;
    
    if (pass.escalationStatus.isOverdue) {
      return <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        OVERDUE
      </Badge>;
    }
    if (pass.escalationStatus.shouldEscalate) {
      return <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        ESCALATED
      </Badge>;
    }
    return null;
  };

  // Calculate additional analytics
  const analytics = {
    totalStudents: students.length,
    totalLocations: locations.length,
    activePasses: passes.filter(p => p.status === 'OPEN').length,
    closedPasses: passes.filter(p => p.status === 'CLOSED').length,
    averagePassDuration: passes.length > 0 
      ? passes.reduce((sum, p) => sum + (p.durationMinutes || 0), 0) / passes.length 
      : 0,
    mostActiveLocation: (() => {
      const locationCounts = new Map<string, number>();
      passes.forEach(pass => {
        pass.legs.forEach(leg => {
          locationCounts.set(leg.originLocationId, (locationCounts.get(leg.originLocationId) || 0) + 1);
          locationCounts.set(leg.destinationLocationId, (locationCounts.get(leg.destinationLocationId) || 0) + 1);
        });
      });
      
      let maxLocation = '';
      let maxCount = 0;
      locationCounts.forEach((count, locationId) => {
        if (count > maxCount) {
          maxCount = count;
          maxLocation = locationId;
        }
      });
      
      return {
        locationId: maxLocation,
        name: locations.find(l => l.id === maxLocation)?.name || 'Unknown',
        count: maxCount
      };
    })(),
    mostActiveStudent: (() => {
      const studentCounts = new Map<string, number>();
      passes.forEach(pass => {
        studentCounts.set(pass.studentId, (studentCounts.get(pass.studentId) || 0) + 1);
      });
      
      let maxStudent = '';
      let maxCount = 0;
      studentCounts.forEach((count, studentId) => {
        if (count > maxCount) {
          maxCount = count;
          maxStudent = studentId;
        }
      });
      
      return {
        studentId: maxStudent,
        name: students.find(s => s.id === maxStudent)?.name || 'Unknown',
        count: maxCount
      };
    })()
  };

  if (isLoading || authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p>Loading reports...</p>
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
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">System Reports</h1>
              <p className="text-muted-foreground">
                Comprehensive analytics and reporting for Eagle Pass system
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </header>

        <GlobalEmergencyBanner />

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <ReportingDashboard
          passes={passes}
          students={students}
          locations={locations}
          title="System Analytics"
          description="Comprehensive overview of all pass activity across the system"
        >
          {/* Additional Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalStudents}</div>
                <p className="text-xs text-muted-foreground">
                  Registered in system
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalLocations}</div>
                <p className="text-xs text-muted-foreground">
                  Available destinations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Active Location</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.mostActiveLocation.name}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.mostActiveLocation.count} visits
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Active Student</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.mostActiveStudent.name}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.mostActiveStudent.count} passes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Passes Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Pass Activity</h3>
              <Button variant="outline" size="sm" onClick={fetchData}>
                Refresh Data
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Student</th>
                    <th className="text-left p-2">From</th>
                    <th className="text-left p-2">To</th>
                    <th className="text-left p-2">Duration</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Created</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {passes
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 20)
                    .map((pass) => (
                    <tr key={pass.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div>
                          <div className="font-medium">{pass.student?.name || 'Unknown Student'}</div>
                          <div className="text-sm text-muted-foreground">{pass.student?.email}</div>
                        </div>
                      </td>
                      <td className="p-2">
                        {pass.legsWithDetails && pass.legsWithDetails.length > 0 ?
                          pass.legsWithDetails[0].originLocation?.name : 'Unknown'
                        }
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
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {getStateBadge(pass.status === 'OPEN' ? 
                            (pass.legs[pass.legs.length - 1]?.state || 'OUT') : 'CLOSED'
                          )}
                          {pass.status === 'CLOSED' && (
                            <Badge variant="secondary">CLOSED</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-sm text-muted-foreground">
                        <div>{formatDate(pass.createdAt)}</div>
                        <div>{formatTime(pass.createdAt)}</div>
                      </td>
                      <td className="p-2">
                        <Link href={`/teacher/pass/${pass.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {passes.length > 20 && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Showing 20 most recent passes. Use filters above to see more.
                </p>
              </div>
            )}
          </div>
        </ReportingDashboard>
      </div>
    </div>
  );
} 