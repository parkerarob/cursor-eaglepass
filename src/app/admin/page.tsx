"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRole } from '@/components/RoleProvider';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signOut } from '@/lib/firebase/auth';
import { 
  getUserById, 
  getLocationById, 
  getEmergencyState, 
  setEmergencyState, 
  getAllLocations,
  getEventLogsByDateRange,
  getPassesByDateRange
} from '@/lib/firebase/firestore';
import { User, Pass, Location, Leg } from '@/types';
import { EmergencyBanner } from '@/components/EmergencyBanner';
import { NotificationService } from '@/lib/notificationService';
import { PassService } from '@/lib/passService';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonitoringDashboard } from '@/components/MonitoringDashboard';
import { FrequentFlyersCard } from '@/components/FrequentFlyersCard';
import { StallSitterCard } from '@/components/StallSitterCard';
import { SecurityDashboard } from '@/components/SecurityDashboard';
import { NotificationConfigPanel } from '@/components/NotificationConfigPanel';
import { formatUserName, formatDuration, getSortableName } from '@/lib/utils';

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

interface ReportData {
  totalPasses: number;
  activePasses: number;
  completedPasses: number;
  averageDuration: number;
  mostPopularLocations: Array<{ location: Location; count: number }>;
  studentActivity: Array<{ student: User; passCount: number; totalDuration: number }>;
  recentEvents: Array<{
    id?: string;
    passId?: string;
    studentId?: string;
    actorId: string;
    timestamp: Date;
    eventType: string;
    details?: string;
    notificationLevel?: string;
  }>;
}

export default function AdminPage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const { currentUser: roleUser, isLoading: roleLoading } = useRole();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [passes, setPasses] = useState<PassWithDetails[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emergencyState, setEmergencyStateLocal] = useState<{ active: boolean; activatedBy?: string; activatedAt?: Date } | null>(null);
  const [isTogglingEmergency, setIsTogglingEmergency] = useState(false);
  const [isClosingPass, setIsClosingPass] = useState<string | null>(null);
  const [isClaimingPass, setIsClaimingPass] = useState<string | null>(null);
  
  // Filters
  const [studentFilter, setStudentFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'OPEN' | 'CLOSED'>('all');

  // Auto-refresh
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Reporting state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'monitoring' | 'security' | 'notifications'>('dashboard');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!authUser || !roleUser) {
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        // Use the current user from RoleProvider
        if (roleUser?.role === 'teacher' || roleUser?.role === 'admin' || roleUser?.role === 'dev') {
          setCurrentUser(roleUser);
          await Promise.all([fetchPassData(), fetchLocations()]);
          // Fetch emergency state
          const state = await getEmergencyState();
          setEmergencyStateLocal(state);
        } else {
          setError(`Access denied. Your role (${roleUser?.role || 'unknown'}) does not have admin privileges.`);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [authUser, roleUser, authLoading, roleLoading]);

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

      // Filter for open passes first
      const openPasses = allPasses.filter(p => p.status === 'OPEN');

      // Enrich passes with student and location details
      const enrichedPasses: PassWithDetails[] = await Promise.all(
        openPasses.map(async (pass) => {
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
      
      enrichedPasses.sort((a, b) => {
        const lastLegA = a.legsWithDetails?.[a.legsWithDetails.length - 1]?.leg;
        const lastLegB = b.legsWithDetails?.[b.legsWithDetails.length - 1]?.leg;
        const stateA = lastLegA?.state;
        const stateB = lastLegB?.state;

        // Prioritize 'OUT' state
        if (stateA === 'OUT' && stateB !== 'OUT') return -1;
        if (stateA !== 'OUT' && stateB === 'OUT') return 1;

        // For passes with the same state, sort by duration descending
        return (b.durationMinutes || 0) - (a.durationMinutes || 0);
      });

      setPasses(enrichedPasses);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleClosePass = async (pass: PassWithDetails) => {
    if (!pass.student || !currentUser) return;
    
    setIsClosingPass(pass.id);
    try {
      const result = await PassService.closePass(pass, currentUser);
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

  const handleClaimPass = async (pass: PassWithDetails) => {
    if (!currentUser) return;
    
    setIsClaimingPass(pass.id);
    try {
      const result = await PassService.claimPass(pass, currentUser);
      if (result.success) {
        await fetchPassData();
      } else {
        setError(result.error || 'Failed to claim pass');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsClaimingPass(null);
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
    await setEmergencyState(newState, formatUserName(currentUser));
    const updated = await getEmergencyState();
    setEmergencyStateLocal(updated);
    setIsTogglingEmergency(false);
  };

  // Filter passes
  const filteredPasses = passes.filter(pass => {
    if (statusFilter !== 'all' && pass.status !== statusFilter) return false;
    
    if (studentFilter && !formatUserName(pass.student)?.toLowerCase().includes(studentFilter.toLowerCase())) {
      return false;
    }
    
    if (locationFilter && locationFilter !== 'all' && pass.currentLocation?.id !== locationFilter) {
      return false;
    }
    
    return true;
  });

  const activePasses = filteredPasses
    .filter(p => p.status === 'OPEN')
    .sort((a, b) => {
      const lastLegA = a.legsWithDetails?.[a.legsWithDetails.length - 1]?.leg;
      const lastLegB = b.legsWithDetails?.[b.legsWithDetails.length - 1]?.leg;
      const stateA = lastLegA?.state;
      const stateB = lastLegB?.state;

      // Prioritize 'OUT' state
      if (stateA === 'OUT' && stateB !== 'OUT') return -1;
      if (stateA !== 'OUT' && stateB === 'OUT') return 1;

      // For passes with the same state, sort by duration descending
      return (b.durationMinutes || 0) - (a.durationMinutes || 0);
    });

  // Reporting functions
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            startDate: new Date(customStartDate),
            endDate: new Date(customEndDate)
          };
        }
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    return { startDate, endDate: now };
  };

  const generateReports = async () => {
    setIsLoadingReports(true);
    try {
      const { startDate, endDate } = getDateRange();
      
      // Fetch all passes and events for the date range
      const [filteredPasses, allEvents] = await Promise.all([
        getPassesByDateRange(startDate, endDate),
        getEventLogsByDateRange(startDate, endDate)
      ]);
      
      // Calculate statistics
      const totalPasses = filteredPasses.length;
      const activePasses = filteredPasses.filter(p => p.status === 'OPEN').length;
      const completedPasses = filteredPasses.filter(p => p.status === 'CLOSED').length;
      
      // Calculate average duration
      const completedPassesWithDuration = filteredPasses
        .filter(p => p.status === 'CLOSED' && p.lastUpdatedAt)
        .map(p => {
          const duration = (new Date(p.lastUpdatedAt).getTime() - new Date(p.createdAt).getTime()) / 1000;
          return duration;
        });
      
      const averageDuration = completedPassesWithDuration.length > 0 
        ? completedPassesWithDuration.reduce((sum, duration) => sum + duration, 0) / completedPassesWithDuration.length 
        : 0;

      // Calculate most popular locations
      const locationCounts = new Map<string, number>();
      filteredPasses.forEach(pass => {
        pass.legs.forEach(leg => {
          const locationId = leg.destinationLocationId;
          locationCounts.set(locationId, (locationCounts.get(locationId) || 0) + 1);
        });
      });

      const mostPopularLocationsData = await Promise.all(
        Array.from(locationCounts.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(async ([locationId, count]) => {
            const location = await getLocationById(locationId);
            if (!location) return null;
            return { location, count };
          })
      );
      const mostPopularLocations = mostPopularLocationsData.filter(
        (item): item is { location: Location; count: number } => item !== null
      );

      // Calculate student activity
      const studentCounts = new Map<string, { passCount: number; totalDuration: number }>();
      filteredPasses.forEach(pass => {
        const studentId = pass.studentId;
        const existing = studentCounts.get(studentId) || { passCount: 0, totalDuration: 0 };
        const duration = pass.status === 'CLOSED' && pass.lastUpdatedAt ? (new Date(pass.lastUpdatedAt).getTime() - new Date(pass.createdAt).getTime()) / 1000 : 0;
        
        studentCounts.set(studentId, {
          passCount: existing.passCount + 1,
          totalDuration: existing.totalDuration + duration
        });
      });

      const studentActivityData = await Promise.all(
        Array.from(studentCounts.entries())
          .map(async ([studentId, stats]) => {
            const student = await getUserById(studentId);
            if (!student) return null;
            return { student, ...stats };
          })
      );
      const studentActivity = studentActivityData
        .filter((item): item is { student: User; passCount: number; totalDuration: number } => item !== null)
        .sort((a, b) => {
          // First sort by pass count descending
          if (b.passCount !== a.passCount) {
            return b.passCount - a.passCount;
          }
          // For ties in pass count, sort by last name, first name
          return getSortableName(a.student).localeCompare(getSortableName(b.student));
        })
        .slice(0, 10);

      // Get recent events
      const recentEvents = allEvents
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

      setReportData({
        totalPasses,
        activePasses,
        completedPasses,
        averageDuration,
        mostPopularLocations,
        studentActivity,
        recentEvents
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportPassData = () => {
    if (!reportData) return;
    
    const { startDate, endDate } = getDateRange();
    const filename = `eagle-pass-data-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    
    // Export pass data
    const passData = passes.map(pass => ({
      passId: pass.id,
      studentName: formatUserName(pass.student),
      studentEmail: pass.student?.email || 'Unknown',
      originLocation: pass.legs[0]?.originLocationId || 'Unknown',
      destinationLocation: pass.legs[0]?.destinationLocationId || 'Unknown',
      status: pass.status,
      createdAt: new Date(pass.createdAt).toISOString(),
      lastUpdatedAt: new Date(pass.lastUpdatedAt).toISOString(),
      duration: pass.status === 'CLOSED' ? ((new Date(pass.lastUpdatedAt).getTime() - new Date(pass.createdAt).getTime()) / (1000 * 60)).toFixed(2) : ''
    }));
    
    exportToCSV(passData, filename);
  };

  const exportEventData = () => {
    if (!reportData) return;
    
    const { startDate, endDate } = getDateRange();
    const filename = `eagle-pass-events-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    
    const eventData = reportData.recentEvents.map(event => ({
      eventId: event.id || 'Unknown',
      passId: event.passId || 'N/A',
      studentId: event.studentId || 'N/A',
      actorId: event.actorId,
      eventType: event.eventType,
      timestamp: new Date(event.timestamp).toISOString(),
      details: event.details || '',
      notificationLevel: event.notificationLevel || 'N/A'
    }));
    
    exportToCSV(eventData, filename);
  };

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
      {/* Role Switcher for Dev Users */}
      <RoleSwitcher />
      
      <div className="container mx-auto p-4">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome, {formatUserName(currentUser)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </header>

        <EmergencyBanner
          active={!!emergencyState?.active}
          activatedBy={emergencyState?.activatedBy}
          activatedAt={emergencyState?.activatedAt}
        />

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'reports' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </Button>
          <Button
            variant={activeTab === 'monitoring' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('monitoring')}
          >
            Monitoring
          </Button>
          <Button
            variant={activeTab === 'security' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('security')}
          >
            Security
          </Button>
          <Button
            variant={activeTab === 'notifications' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </Button>
        </div>

        {activeTab === 'dashboard' && (
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
                                <div className="font-medium">{formatUserName(pass.student)}</div>
                                <div className="text-sm text-muted-foreground">{pass.student?.email}</div>
                                {pass.claimedBy && (
                                  <Badge variant="secondary" className="mt-1">
                                    Claimed by {pass.claimedBy.userName}
                                  </Badge>
                                )}
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
                              <div className="flex flex-col gap-2 items-start">
                                <Button
                                  onClick={() => handleClosePass(pass)}
                                  disabled={isClosingPass === pass.id}
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                >
                                  {isClosingPass === pass.id ? 'Closing...' : 'Close Pass'}
                                </Button>
                                {emergencyState?.active && pass.status === 'OPEN' && pass.legs[pass.legs.length - 1]?.state === 'OUT' && !pass.claimedBy && (
                                  <Button
                                    onClick={() => handleClaimPass(pass)}
                                    disabled={isClaimingPass === pass.id}
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                  >
                                    {isClaimingPass === pass.id ? 'Claiming...' : 'Claim Student'}
                                  </Button>
                                )}
                              </div>
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
                      <span className="ml-2 text-sm text-muted-foreground">(by {formatUserName({ id: '', email: emergencyState.activatedBy, role: 'admin' })})</span>
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
        )}

        {activeTab === 'reports' && (
          <div className="grid gap-6">
            <FrequentFlyersCard title="Frequent Flyers" limit={5} />
            <StallSitterCard limit={5} />
            {/* Report Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Report Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date Range</label>
                    <Select value={dateRange} onValueChange={(value: 'today' | 'week' | 'month' | 'custom') => setDateRange(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">Last 7 Days</SelectItem>
                        <SelectItem value="month">Last 30 Days</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {dateRange === 'custom' && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Start Date</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">End Date</label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-end">
                    <Button 
                      onClick={generateReports} 
                      disabled={isLoadingReports}
                      className="w-full"
                    >
                      {isLoadingReports ? 'Generating...' : 'Generate Report'}
                    </Button>
                  </div>
                </div>
                
                {reportData && (
                  <div className="flex gap-2">
                    <Button onClick={exportPassData} variant="outline" size="sm">
                      Export Pass Data (CSV)
                    </Button>
                    <Button onClick={exportEventData} variant="outline" size="sm">
                      Export Event Data (CSV)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Report Results */}
            {reportData && (
              <>
                {/* Summary Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Summary Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {reportData.totalPasses}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Passes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {reportData.completedPasses}
                        </div>
                        <div className="text-sm text-muted-foreground">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {reportData.activePasses}
                        </div>
                        <div className="text-sm text-muted-foreground">Active</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {formatDuration(reportData.averageDuration)}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg Duration</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Most Popular Locations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Most Popular Locations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reportData.mostPopularLocations.map((item, index) => (
                        <div key={item.location.id} className="flex justify-between items-center p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">#{index + 1}</span>
                            <span className="font-medium">{item.location.name}</span>
                            <Badge variant="outline">{item.location.locationType}</Badge>
                          </div>
                          <span className="font-bold">{item.count} visits</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Student Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Student Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Student</th>
                            <th className="text-left p-2">Pass Count</th>
                            <th className="text-left p-2">Total Duration</th>
                            <th className="text-left p-2">Avg Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.studentActivity.map((item) => (
                            <tr key={item.student.id} className="border-b">
                              <td className="p-2">
                                <div>
                                  <div className="font-medium">{formatUserName(item.student)}</div>
                                  <div className="text-sm text-muted-foreground">{item.student.email}</div>
                                </div>
                              </td>
                              <td className="p-2 font-bold">{item.passCount}</td>
                              <td className="p-2">{formatDuration(item.totalDuration)}</td>
                              <td className="p-2">{formatDuration(item.totalDuration / item.passCount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Events */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {reportData.recentEvents.map((event, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{event.eventType}</Badge>
                            <span className="text-sm">
                              {event.studentId ? `Student: ${event.studentId}` : 'System Event'}
                            </span>
                            {event.details && (
                              <span className="text-sm text-muted-foreground">{event.details}</span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatTime(new Date(event.timestamp))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="grid gap-6">
            <MonitoringDashboard />
          </div>
        )}

        {activeTab === 'security' && (
          <div className="grid gap-6">
            <SecurityDashboard currentUser={currentUser} />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="grid gap-6">
            <NotificationConfigPanel onConfigUpdate={() => {
              // Refresh data when config is updated
              fetchPassData();
            }} />
          </div>
        )}
      </div>
    </div>
  );
} 