"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Login } from '@/components/Login';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { signOut } from '@/lib/firebase/auth';
import { getUserByEmail, getStudentById, getLocationById, getAllPasses } from '@/lib/firebase/firestore';
import { User, Pass, Location, Leg } from '@/types';

interface PassWithDetails extends Pass {
  student?: User;
  legsWithDetails?: Array<{
    leg: Leg;
    originLocation?: Location;
    destinationLocation?: Location;
  }>;
}

export default function AdminPage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [passes, setPasses] = useState<PassWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          await fetchPassData();
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
          return {
            ...pass,
            student: student || undefined,
            legsWithDetails: legsWithDetails.map(legDetail => ({
              leg: legDetail.leg,
              originLocation: legDetail.originLocation || undefined,
              destinationLocation: legDetail.destinationLocation || undefined,
            })),
          };
        })
      );
      setPasses(enrichedPasses);
    } catch (e) {
      setError((e as Error).message);
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
      <ThemeToggle />
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-3xl font-bold">Eagle Pass - Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome, {currentUser?.name} ({currentUser?.role})
            </p>
          </div>
          <Button onClick={signOut} variant="outline" size="sm">Sign Out</Button>
        </header>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="text-2xl font-bold text-purple-600">
                    {passes.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Passes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pass History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {passes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No passes found in the system.
                  </p>
                ) : (
                  passes.map((pass) => (
                    <Card key={pass.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {pass.student?.name || `Student ${pass.studentId}`}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Pass ID: {pass.id}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {getStatusBadge(pass.status)}
                            {pass.legsWithDetails && pass.legsWithDetails.length > 0 && (
                              getStateBadge(pass.legsWithDetails[pass.legsWithDetails.length - 1].leg.state)
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            <strong>Created:</strong> {formatDate(pass.createdAt)} at {formatTime(pass.createdAt)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <strong>Last Updated:</strong> {formatDate(pass.lastUpdatedAt)} at {formatTime(pass.lastUpdatedAt)}
                          </div>
                        </div>

                        {pass.legsWithDetails && pass.legsWithDetails.length > 0 && (
                          <div className="mt-4">
                            <h4 className="font-medium mb-2">Movement History:</h4>
                            <div className="space-y-2">
                              {pass.legsWithDetails.map((legDetail, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium">
                                    {legDetail.leg.legNumber}
                                  </div>
                                  <div className="flex-1">
                                    <span className="font-medium">
                                      {legDetail.originLocation?.name || 'Unknown'}
                                    </span>
                                    <span className="mx-2">→</span>
                                    <span className="font-medium">
                                      {legDetail.destinationLocation?.name || 'Unknown'}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    {getStateBadge(legDetail.leg.state)}
                                    <span className="text-muted-foreground">
                                      {formatTime(legDetail.leg.timestamp)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 