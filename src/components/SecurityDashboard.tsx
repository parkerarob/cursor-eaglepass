"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditMonitor } from '@/lib/auditMonitor';
import { AlertTriangle, Shield, Bell, Activity, Clock, Users, Eye } from 'lucide-react';

interface SecurityDashboardProps {
  currentUser: { id: string; name?: string; role: string } | null;
}

export function SecurityDashboard({ currentUser }: SecurityDashboardProps) {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    studentId: string;
    timestamp: Date;
    details?: Record<string, unknown>;
  }>>([]);
  const [metrics, setMetrics] = useState<{
    totalPasses?: number;
    longDurationPasses?: number;
    rapidCreationIncidents?: number;
    suspiciousPatterns?: number;
    securityViolations?: number;
    averageDuration?: number;
  } | null>(null);
  const [auditSummary, setAuditSummary] = useState<{
    unacknowledgedAlerts?: number;
    criticalAlerts?: number;
    alertsByType?: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSecurityData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSecurityData = async () => {
    try {
      setIsLoading(true);
      
      // Load audit data
      const activeAlerts = AuditMonitor.getActiveAlerts();
      const auditMetrics = await AuditMonitor.generateAuditMetrics('day');
      const summary = AuditMonitor.getAuditSummary();
      
      setAlerts(activeAlerts);
      setMetrics(auditMetrics);
      setAuditSummary(summary);
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    if (currentUser) {
      const success = AuditMonitor.acknowledgeAlert(alertId, currentUser.id);
      if (success) {
        loadSecurityData(); // Refresh data
      }
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'HIGH': return 'bg-orange-500 text-white';
      case 'MEDIUM': return 'bg-yellow-500 text-black';
      case 'LOW': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'EXCESSIVE_PASSES': return <Users className="h-4 w-4" />;
      case 'RAPID_CREATION': return <Activity className="h-4 w-4" />;
      case 'LONG_DURATION': return <Clock className="h-4 w-4" />;
      case 'UNUSUAL_PATTERN': return <Eye className="h-4 w-4" />;
      case 'SECURITY_VIOLATION': return <AlertTriangle className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading security data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Security Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold">{auditSummary?.unacknowledgedAlerts || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-500">{auditSummary?.criticalAlerts || 0}</p>
              </div>
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Passes (24h)</p>
                <p className="text-2xl font-bold">{metrics?.totalPasses || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Security Events</p>
                <p className="text-2xl font-bold">{metrics?.securityViolations || 0}</p>
              </div>
              <Bell className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Security Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Monitoring
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadSecurityData}
              className="ml-auto"
            >
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="alerts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>

            <TabsContent value="alerts" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Active Security Alerts</h3>
                <Badge variant="outline">{alerts.length} alerts</Badge>
              </div>

              {alerts.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Shield className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-600">All Clear</h3>
                    <p className="text-muted-foreground">No active security alerts</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <Alert key={alert.id} className="border-l-4 border-l-orange-500">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getAlertIcon(alert.type)}
                          <div className="flex-1">
                            <AlertTitle className="flex items-center gap-2">
                              {alert.description}
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                            </AlertTitle>
                            <AlertDescription className="mt-2">
                              <div className="text-sm text-muted-foreground">
                                Student ID: {alert.studentId} | 
                                Time: {alert.timestamp.toLocaleString()} |
                                Type: {alert.type.replace('_', ' ')}
                              </div>
                            </AlertDescription>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      </div>
                    </Alert>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <h3 className="text-lg font-semibold">Security Metrics (Last 24 Hours)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pass Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Passes Created:</span>
                        <span className="font-bold">{metrics?.totalPasses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Long Duration Alerts:</span>
                        <span className="font-bold text-orange-500">{metrics?.longDurationPasses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rapid Creation Incidents:</span>
                        <span className="font-bold text-red-500">{metrics?.rapidCreationIncidents}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Security Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Suspicious Patterns:</span>
                        <span className="font-bold text-yellow-500">{metrics?.suspiciousPatterns}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Security Violations:</span>
                        <span className="font-bold text-red-500">{metrics?.securityViolations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Duration:</span>
                        <span className="font-bold">{metrics?.averageDuration}min</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <h3 className="text-lg font-semibold">Notification System Status</h3>
              
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertTitle>Notification System Active</AlertTitle>
                <AlertDescription>
                  Multi-channel notifications are operational. Teachers and administrators will be notified 
                  of student pass escalations via email, SMS, push notifications, and dashboard alerts.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h4 className="font-medium">Active Channels:</h4>
                <div className="flex gap-2">
                  <Badge variant="secondary">📧 Email</Badge>
                  <Badge variant="secondary">📱 SMS</Badge>
                  <Badge variant="secondary">🔔 Push</Badge>
                  <Badge variant="secondary">📊 Dashboard</Badge>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 