"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { monitoringService } from '@/lib/monitoringService';

interface SystemHealth {
  eventQueueSize: number;
  activeTraces: number;
  isInitialized: boolean;
}

interface PerformanceMetrics {
  apiCalls: Array<{
    name: string;
    averageDuration: number;
    totalCalls: number;
    errorRate: number;
  }>;
  pageLoads: Array<{
    page: string;
    averageLoadTime: number;
    totalLoads: number;
  }>;
}

export function MonitoringDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performanceMetrics] = useState<PerformanceMetrics>({
    apiCalls: [],
    pageLoads: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const updateMetrics = () => {
      const health = monitoringService.getSystemHealth();
      setSystemHealth(health);
      setLastUpdated(new Date());
      setIsLoading(false);
    };

    // Initial load
    updateMetrics();

    // Update every 30 seconds
    const interval = setInterval(updateMetrics, 30000);

    return () => clearInterval(interval);
  }, []);

  const getHealthStatus = (health: SystemHealth) => {
    if (!health.isInitialized) return { status: 'error', label: 'Not Initialized' };
    if (health.eventQueueSize > 50) return { status: 'warning', label: 'High Queue' };
    if (health.activeTraces > 10) return { status: 'warning', label: 'Many Traces' };
    return { status: 'success', label: 'Healthy' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-600">Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-600">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    const health = monitoringService.getSystemHealth();
    setSystemHealth(health);
    setLastUpdated(new Date());
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading monitoring data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!systemHealth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Unable to load monitoring data</p>
        </CardContent>
      </Card>
    );
  }

  const healthStatus = getHealthStatus(systemHealth);

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>System Health</CardTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(healthStatus.status)}
              <Button onClick={handleRefresh} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {systemHealth.eventQueueSize}
              </div>
              <div className="text-sm text-muted-foreground">Event Queue Size</div>
              <div className="text-xs text-muted-foreground">
                {systemHealth.eventQueueSize > 50 ? 'High - Consider processing' : 'Normal'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {systemHealth.activeTraces}
              </div>
              <div className="text-sm text-muted-foreground">Active Traces</div>
              <div className="text-xs text-muted-foreground">
                {systemHealth.activeTraces > 10 ? 'Many active traces' : 'Normal activity'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {systemHealth.isInitialized ? '✓' : '✗'}
              </div>
              <div className="text-sm text-muted-foreground" data-testid="system-monitoring-status">Monitoring Status</div>
              <div className="text-xs text-muted-foreground">
                {systemHealth.isInitialized ? 'Initialized' : 'Not initialized'}
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">API Performance</h4>
              {performanceMetrics.apiCalls.length > 0 ? (
                <div className="space-y-2">
                  {performanceMetrics.apiCalls.map((api) => (
                    <div key={api.name} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">{api.name}</span>
                        <div className="text-sm text-muted-foreground">
                          {api.totalCalls} calls, {api.errorRate.toFixed(1)}% error rate
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{api.averageDuration.toFixed(0)}ms</div>
                        <div className="text-sm text-muted-foreground">avg duration</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No API performance data available</p>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Page Load Performance</h4>
              {performanceMetrics.pageLoads.length > 0 ? (
                <div className="space-y-2">
                  {performanceMetrics.pageLoads.map((page) => (
                    <div key={page.page} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium">{page.page}</span>
                        <div className="text-sm text-muted-foreground">
                          {page.totalLoads} loads
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{page.averageLoadTime.toFixed(0)}ms</div>
                        <div className="text-sm text-muted-foreground">avg load time</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No page load data available</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Status */}
      <Card>
        <CardHeader>
          <CardTitle data-testid="monitoring-section-title">Monitoring Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>Firebase Performance</span>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Error Tracking</span>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>User Action Logging</span>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Security Monitoring</span>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 