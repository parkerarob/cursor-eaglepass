"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/components/RoleProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signOut } from '@/lib/firebase/auth';
import { 
  getAllPasses,
  getUserById,
  getLocationById,
} from '@/lib/firebase/firestore';
import { User, Pass, Location, Leg } from '@/types';
import { GlobalEmergencyBanner } from '@/components/GlobalEmergencyBanner';
import { NotificationService } from '@/lib/notificationService';
import { PassService } from '@/lib/passService';
import Link from 'next/link';
import { ArrowLeft, Clock, MapPin, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

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

export default function PassDetailPage() {
  const params = useParams();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { currentUser: roleUser, isLoading: roleLoading } = useRole();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pass, setPass] = useState<PassWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClosingPass, setIsClosingPass] = useState(false);

  const passId = params.id as string;

  // Memoized data processing for performance
  const processedPass = useMemo(() => {
    if (!pass) return null;

    // Calculate total duration and individual leg durations
    const legsWithDuration = pass.legsWithDetails?.map((legDetail, index) => {
      const leg = legDetail.leg;
      const nextLeg = pass.legsWithDetails?.[index + 1];
      
      let duration = 0;
      if (nextLeg) {
        duration = (new Date(nextLeg.leg.timestamp).getTime() - new Date(leg.timestamp).getTime()) / (1000 * 60);
      } else if (pass.status === 'OPEN') {
        duration = (new Date().getTime() - new Date(leg.timestamp).getTime()) / (1000 * 60);
      }
      
      return {
        ...legDetail,
        durationMinutes: Math.max(0, duration),
      };
    }) || [];

    return {
      ...pass,
      legsWithDuration,
      totalDuration: pass.durationMinutes || 0,
    };
  }, [pass]);

  const fetchPassData = useCallback(async () => {
    if (!passId) {
      setError('No pass ID provided');
      return;
    }

    try {
      // Fetch all passes and find the specific one
      const allPasses = await getAllPasses();
      const targetPass = allPasses.find(p => p.id === passId);
      
      if (!targetPass) {
        setError('Pass not found');
        return;
      }

      // Enrich pass with details
      const student = await getUserById(targetPass.studentId);
      const legsWithDetails = await Promise.all(
        targetPass.legs.map(async (leg) => ({
          leg,
          originLocation: await getLocationById(leg.originLocationId),
          destinationLocation: await getLocationById(leg.destinationLocationId),
        }))
      );
      
      // Get current location based on last leg
      let currentLocation: Location | undefined;
      if (targetPass.legs.length > 0) {
        const lastLeg = targetPass.legs[targetPass.legs.length - 1];
        if (lastLeg.state === 'IN') {
          const location = await getLocationById(lastLeg.destinationLocationId);
          currentLocation = location || undefined;
        } else {
          const location = await getLocationById(lastLeg.originLocationId);
          currentLocation = location || undefined;
        }
      }

      // Calculate duration and escalation status
      const durationMinutes = NotificationService.calculateDuration(targetPass);
      const escalationStatus = NotificationService.getNotificationStatus(targetPass);

      const enrichedPass: PassWithDetails = {
        ...targetPass,
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

      setPass(enrichedPass);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [passId]);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!authUser || !roleUser) {
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        if (roleUser?.role === 'teacher') {
          setCurrentUser(roleUser);
          await fetchPassData();
        } else {
          setError(`Access denied. Your role (${roleUser?.role || 'unknown'}) does not have teacher privileges.`);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    };

    fetchUserData();
  }, [authUser, roleUser, authLoading, roleLoading, fetchPassData]);

  const handleClosePass = async () => {
    if (!pass || !currentUser) return;
    
    setIsClosingPass(true);
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
      setIsClosingPass(false);
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

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'IN':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'OUT':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'CLOSED':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <MapPin className="h-4 w-4 text-blue-600" />;
    }
  };

  const getEscalationBadge = () => {
    if (!processedPass?.escalationStatus) return null;
    
    if (processedPass.escalationStatus.isOverdue) {
      return <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        OVERDUE
      </Badge>;
    }
    if (processedPass.escalationStatus.shouldEscalate) {
      return <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        ESCALATED
      </Badge>;
    }
    return null;
  };

  if (isLoading || authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p>Loading pass details...</p>
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

  if (!processedPass) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Pass Not Found</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Link href="/teacher">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Link href="/teacher">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Pass Details</h1>
              <p className="text-muted-foreground">
                {processedPass.student?.name} • {formatDate(processedPass.createdAt)}
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

        {/* Pass Overview */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Pass Overview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Complete journey details for {processedPass.student?.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getEscalationBadge()}
                {processedPass.status === 'OPEN' && (
                  <Button
                    onClick={handleClosePass}
                    disabled={isClosingPass}
                    variant="outline"
                    size="sm"
                  >
                    {isClosingPass ? 'Closing...' : 'Close Pass'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Student</p>
                <p className="font-semibold">{processedPass.student?.name}</p>
                <p className="text-sm text-muted-foreground">{processedPass.student?.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <Badge data-testid="status-badge" variant={processedPass.status === 'OPEN' ? 'default' : 'secondary'}>
                    {processedPass.status}
                  </Badge>
                  <Badge data-testid="location-badge" variant="outline">
                    {processedPass.legs[processedPass.legs.length - 1]?.state === 'IN' ? 'IN' : 'OUT'}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Duration</p>
                <p className="font-semibold">{formatDuration(processedPass.totalDuration)}</p>
                {processedPass.escalationStatus && (
                  <p className="text-xs text-muted-foreground">
                    Level: {processedPass.escalationStatus.notificationLevel}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Journey Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Journey Timeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Complete movement history with timing details
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processedPass.legsWithDuration?.map((legDetail, index) => {
                const leg = legDetail.leg;
                const isLastLeg = index === processedPass.legsWithDuration!.length - 1;
                const isActive = processedPass.status === 'OPEN' && isLastLeg;
                
                return (
                  <div key={leg.timestamp.toString()} className="flex items-start gap-4">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 ${
                        isActive ? 'bg-blue-500 border-blue-500' : 
                        leg.state === 'IN' ? 'bg-green-500 border-green-500' : 
                        'bg-orange-500 border-orange-500'
                      }`} />
                      {!isLastLeg && (
                        <div className="w-0.5 h-8 bg-gray-300 mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(leg.state)}
                          <span className="font-medium">
                            {leg.state === 'IN' ? 'Arrived at' : 'Departed from'}
                          </span>
                          <span className="font-semibold">
                            {legDetail.destinationLocation?.name || legDetail.originLocation?.name || 'Unknown Location'}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTime(leg.timestamp)}
                        </div>
                      </div>

                      {/* Location details */}
                      <div className="ml-6 mb-2">
                        <p className="text-sm text-muted-foreground">
                          {leg.state === 'IN' ? 'From' : 'To'}: {legDetail.originLocation?.name || 'Unknown'} 
                          {leg.state === 'IN' ? ' → ' : ' ← '}
                          {legDetail.destinationLocation?.name || 'Unknown'}
                        </p>
                      </div>

                      {/* Duration at this location */}
                      {legDetail.durationMinutes !== undefined && (
                        <div className="ml-6">
                          <p className="text-sm text-muted-foreground">
                            Duration: {formatDuration(legDetail.durationMinutes)}
                          </p>
                        </div>
                      )}

                      {/* Escalation info for active leg */}
                      {isActive && processedPass.escalationStatus && (
                        <div className="ml-6 mt-2">
                          {getEscalationBadge()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Total Legs</p>
                  <p className="font-semibold">{processedPass.legsWithDuration?.length || 0}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Created</p>
                  <p className="font-semibold">{formatDate(processedPass.createdAt)} at {formatTime(processedPass.createdAt)}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Last Updated</p>
                  <p className="font-semibold">{formatDate(processedPass.lastUpdatedAt)} at {formatTime(processedPass.lastUpdatedAt)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 