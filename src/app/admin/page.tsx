"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Login } from '@/components/Login';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signOut } from '@/lib/firebase/auth';
import { getUserByEmail, getStudentById, getLocationById, getEmergencyState, setEmergencyState, getAllLocations } from '@/lib/firebase/firestore';
import { User, Pass, Location, Leg } from '@/types';
import { EmergencyBanner } from '@/components/EmergencyBanner';
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
}

export default function AdminPage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [passes, setPasses] = useState<PassWithDetails[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emergencyState, setEmergencyStateLocal] = useState<{ active: boolean; activatedBy?: string; activatedAt?: Date } | null>(null);
  const [isTogglingEmergency, setIsTogglingEmergency] = useState(false);
  const [isClosingPass, setIsClosingPass] = useState<string | null>(null);
  
  // Filters
  const [studentFilter, setStudentFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'OPEN' | 'CLOSED'>('all');

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        const userProfile = await getUserByEmail(authUser.email!);
        if (userProfile?.role === 'teacher' || userProfile?.role === 'admin' || userProfile?.role === 'dev') {
          setCurrentUser(userProfile);
          await Promise.all([fetchPassData(), fetchLocations()]);
          // Fetch emergency state
          const state = await getEmergencyState();
          setEmergencyStateLocal(state);
        } else {
          setError(`Access denied. Your role (${userProfile?.role || 'unknown'}) does not have admin privileges.`);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [authUser, authLoading]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !currentUser) return;

    const interval = setInterval(() => {
      fetchPassData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, currentUser]);

  const fetchLocations = async () => {
    try {
      const allLocations = await getAllLocations();
      setLocations(allLocations);
    } catch (e) {
      console.error('Failed to fetch locations:', e);
    }
  };

  const fetchPassData = async () => {
    try {
      // Fetch all passes from Firestore
      const { getAllPasses } = await import('@/lib/firebase/firestore');
      const allPasses = await getAllPasses();

      // Enrich passes with student and location details
      const enrichedPasses: PassWithDetails[] = await Promise.all(
        allPasses.map(async (pass) => {
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
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleClosePass = async (pass: PassWithDetails) => {
    if (!pass.student || !currentUser) return;
    
    setIsClosingPass(pass.id);
    try {
      const result = await PassService.closePass(pass, pass.student);
      if (result.success) {
        // Refresh the pass data
        await fetchPassData();
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
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getStatusBadge = (status: string) => {
    return status === 'OPEN' ? (
      <Badge variant="destructive">Active</Badge>
    ) : (
      <Badge variant="secondary">Closed</Badge>
    );
  };

  const getStateBadge = (state: string) => {
    return state === 'IN' ? (
      <Badge variant="default">Present</Badge>
    ) : (
      <Badge variant="outline">Traveling</Badge>
    );
  };

  const getEscalationBadge = (pass: PassWithDetails) => {
    if (!pass.escalationStatus) return null;
    
    if (pass.escalationStatus.isOverdue) {
      return <Badge variant="destructive">OVERDUE</Badge>;
    }
    
    if (pass.escalationStatus.shouldEscalate) {
      return <Badge variant="secondary">ESCALATED</Badge>;
    }
    
    return null;
  };

  const handleToggleEmergency = async () => {
    if (!currentUser) return;
    setIsTogglingEmergency(true);
    const newState = !(emergencyState?.active);
    await setEmergencyState(newState, currentUser.name || currentUser.email);
    const updated = await getEmergencyState();
    setEmergencyStateLocal(updated);
    setIsTogglingEmergency(false);
  };

  // Filter passes
  const filteredPasses = passes.filter(pass => {
    if (statusFilter !== 'all' && pass.status !== statusFilter) return false;
    
    if (studentFilter && !pass.student?.name?.toLowerCase().includes(studentFilter.toLowerCase())) {
      return false;
    }
    
    if (locationFilter && locationFilter !== 'all' && pass.currentLocation?.id !== locationFilter) {
      return false;
    }
    
    return true;
  });

  const activePasses = filteredPasses.filter(p => p.status === 'OPEN');

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!authUser) {
    return <Login />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={signOut} variant="outline">Sign Out</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <EmergencyBanner
        active={!!emergencyState?.active}
        activatedBy={emergencyState?.activatedBy}
        activatedAt={emergencyState?.activatedAt}
      />
      <ThemeToggle />
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-3xl font-bold">Eagle Pass - Teacher Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome, {currentUser?.name} ({currentUser?.role})
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setAutoRefresh(!autoRefresh)} 
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
            >
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
            <Button onClick={signOut} variant="outline" size="sm">Sign Out</Button>
          </div>
        </header>

        <div className="grid gap-6">
          {/* System Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {passes.filter(p => p.status === 'OPEN').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Passes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {passes.filter(p => p.status === 'CLOSED').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed Passes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {passes.filter(p => p.status === 'OPEN' && p.escalationStatus?.shouldEscalate).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Escalated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {passes.filter(p => p.status === 'OPEN' && p.escalationStatus?.isOverdue).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Overdue</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Passes Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Active Passes ({activePasses.length})</CardTitle>
                <Button onClick={fetchPassData} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Student Name</label>
                  <Input
                    placeholder="Filter by student name..."
                    value={studentFilter}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={(value: 'all' | 'OPEN' | 'CLOSED') => setStatusFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All passes</SelectItem>
                      <SelectItem value="OPEN">Active only</SelectItem>
                      <SelectItem value="CLOSED">Closed only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Passes Table */}
              {activePasses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active passes found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Student</th>
                        <th className="text-left p-2">Current Location</th>
                        <th className="text-left p-2">Duration</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Created</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePasses.map((pass) => (
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
                              {pass.legsWithDetails && pass.legsWithDetails.length > 0 && (
                                getStateBadge(pass.legsWithDetails[pass.legsWithDetails.length - 1].leg.state)
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono">{formatDuration(pass.durationMinutes || 0)}</span>
                              {getEscalationBadge(pass)}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(pass.status)}
                              {pass.notificationLevel && pass.notificationLevel !== 'none' && (
                                <Badge variant="outline" className="text-xs">
                                  {pass.notificationLevel.toUpperCase()} NOTIFIED
                                </Badge>
                              )}
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

          {/* Emergency Freeze Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Emergency Freeze Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 items-start">
                <div>
                  <span className="font-semibold">Current State:</span>{' '}
                  {emergencyState?.active ? (
                    <span className="text-red-600 font-bold">ACTIVE</span>
                  ) : (
                    <span className="text-green-600 font-bold">INACTIVE</span>
                  )}
                  {emergencyState?.activatedBy && (
                    <span className="ml-2 text-sm text-muted-foreground">(by {emergencyState.activatedBy})</span>
                  )}
                </div>
                <Button
                  onClick={handleToggleEmergency}
                  variant={emergencyState?.active ? 'destructive' : 'default'}
                  disabled={isTogglingEmergency}
                >
                  {isTogglingEmergency
                    ? (emergencyState?.active ? 'Deactivating...' : 'Activating...')
                    : (emergencyState?.active ? 'Deactivate Emergency Freeze' : 'Activate Emergency Freeze')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 