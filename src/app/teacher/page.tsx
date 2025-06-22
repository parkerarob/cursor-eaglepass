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
  getAllPasses,
  getUserById,
  getLocationById,
  getAllLocations,
  getStudentsByAssignedLocation,
  getClassroomPolicy,
  getAllStudents,
} from '@/lib/firebase/firestore';
import { User, Pass, Location, Leg } from '@/types';
import { ClassroomPolicy } from '@/types/policy';
import { GlobalEmergencyBanner } from '@/components/GlobalEmergencyBanner';
import { NotificationService } from '@/lib/notificationService';
import { PassService } from '@/lib/passService';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

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
  const [policy, setPolicy] = useState<ClassroomPolicy | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  // State for Student Pass History
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentPassHistory, setStudentPassHistory] = useState<PassWithDetails[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  useEffect(() => {
    if (!currentUser?.assignedLocationId) return;
    setIsLoadingPolicy(true);
    getClassroomPolicy(currentUser.assignedLocationId)
      .then((policy) => setPolicy(policy))
      .catch(() => setPolicy(null))
      .finally(() => setIsLoadingPolicy(false));
  }, [currentUser?.assignedLocationId]);

  // Fetch all students for search
  useEffect(() => {
    const fetchAllStudents = async () => {
      try {
        const students = await getAllStudents();
        setAllStudents(students);
      } catch (err) {
        console.error('Failed to fetch students:', err);
      }
    };
    fetchAllStudents();
  }, []);

  const handleStudentSearch = async (student: User) => {
    setSelectedStudent(student);
    setIsLoadingHistory(true);
    
    try {
      // Fetch all passes for this student
      const allPasses = await getAllPasses();
      const studentPasses = allPasses.filter(pass => pass.studentId === student.id);
      
      // Enrich passes with details (similar to fetchPassData logic)
      const enrichedPasses: PassWithDetails[] = await Promise.all(
        studentPasses.map(async (pass) => {
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
      
      setStudentPassHistory(enrichedPasses);
    } catch (err) {
      setError('Failed to load student pass history.');
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Filter students based on search term
  const filteredStudents = allStudents.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <Link href="/teacher/groups">
              <Button variant="outline">Manage Groups</Button>
            </Link>
            <ThemeToggle />
            <Link href="/teacher/settings">
              <Button variant="outline" size="sm">Settings</Button>
            </Link>
            <Button onClick={signOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </header>

        <GlobalEmergencyBanner />

        {/* Classroom Policy Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current Classroom Policy</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPolicy ? (
              <p>Loading policy...</p>
            ) : policy ? (
              <div className="space-y-2">
                <PolicySummaryRow label="Students leaving your classroom" value={policy.rules.studentLeave} />
                <PolicySummaryRow label="Students arriving to your classroom" value={policy.rules.studentArrive} />
                <PolicySummaryRow label="Teacher requests for your students" value={policy.rules.teacherRequest} />
              </div>
            ) : (
              <p className="text-muted-foreground">No classroom policy set for this room.</p>
            )}
          </CardContent>
        </Card>

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
                          <div className="flex gap-2">
                            <Link href={`/teacher/pass/${pass.id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                            <Button
                              onClick={() => handleClosePass(pass)}
                              disabled={isClosingPass === pass.id}
                              variant="outline"
                              size="sm"
                            >
                              {isClosingPass === pass.id ? 'Closing...' : 'Close Pass'}
                            </Button>
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
                          <div className="flex gap-2">
                            <Link href={`/teacher/pass/${pass.id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                            <Button
                              onClick={() => handleClosePass(pass)}
                              disabled={isClosingPass === pass.id}
                              variant="outline"
                              size="sm"
                            >
                              {isClosingPass === pass.id ? 'Closing...' : 'Close Pass'}
                            </Button>
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
                          <div className="flex gap-2">
                            <Link href={`/teacher/pass/${pass.id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                            <Button
                              onClick={() => handleClosePass(pass)}
                              disabled={isClosingPass === pass.id}
                              variant="outline"
                              size="sm"
                            >
                              {isClosingPass === pass.id ? 'Closing...' : 'Close Pass'}
                            </Button>
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

        {/* Student Pass History */}
        <Card>
          <CardHeader>
            <CardTitle>Student Pass History</CardTitle>
            <p className="text-sm text-muted-foreground">
              Search for any student to view their complete pass history
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Student Search */}
              <div className="flex gap-2">
                <Input
                  placeholder="Search students by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>

              {/* Search Results */}
              {searchTerm && (
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students found</p>
                  ) : (
                    <div className="space-y-1">
                      {filteredStudents.slice(0, 10).map((student) => (
                        <button
                          key={student.id}
                          onClick={() => handleStudentSearch(student)}
                          className="w-full text-left p-2 hover:bg-muted rounded-md text-sm"
                        >
                          <div className="font-medium">{student.name}</div>
                          <div className="text-muted-foreground">{student.email}</div>
                        </button>
                      ))}
                      {filteredStudents.length > 10 && (
                        <p className="text-xs text-muted-foreground p-2">
                          Showing first 10 results. Refine your search for more specific results.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Student History */}
              {selectedStudent && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedStudent.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedStudent(null);
                        setStudentPassHistory([]);
                        setSearchTerm('');
                      }}
                    >
                      Clear
                    </Button>
                  </div>

                  {isLoadingHistory ? (
                    <p>Loading pass history...</p>
                  ) : (
                    <div>
                      <div className="mb-2">
                        <span className="text-sm text-muted-foreground">
                          {studentPassHistory.length} passes found
                        </span>
                      </div>
                      
                      {studentPassHistory.length === 0 ? (
                        <p className="text-muted-foreground">No pass history found for this student.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-2">Date</th>
                                <th className="text-left p-2">From</th>
                                <th className="text-left p-2">To</th>
                                <th className="text-left p-2">Duration</th>
                                <th className="text-left p-2">Status</th>
                                <th className="text-left p-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentPassHistory
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map((pass) => (
                                <tr key={pass.id} className="border-b hover:bg-muted/50">
                                  <td className="p-2 text-sm">
                                    <div>{formatDate(pass.createdAt)}</div>
                                    <div className="text-muted-foreground">{formatTime(pass.createdAt)}</div>
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
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PolicySummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <Badge variant={
        value === 'Allow' ? 'success' : value === 'Require Approval' ? 'warning' : 'destructive'
      }>
        {value}
      </Badge>
    </div>
  );
}