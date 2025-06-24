"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Pass, Location } from '@/types';
import { Download, Filter, BarChart3, Clock, MapPin, Users } from 'lucide-react';

interface ReportingMetrics {
  totalPasses: number;
  activePasses: number;
  averageDuration: number;
  overduePasses: number;
  escalatedPasses: number;
  uniqueStudents: number;
  uniqueLocations: number;
}

interface ReportingDashboardProps {
  passes: Pass[];
  students: User[];
  locations: Location[];
  title: string;
  description?: string;
  onExport?: (filteredData: Pass[]) => void;
  children?: React.ReactNode;
}

export function ReportingDashboard({
  passes,
  students,
  locations,
  title,
  description,
  onExport,
  children
}: ReportingDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  // Calculate metrics - simplified for JSDOM compatibility
  const metrics: ReportingMetrics = useMemo(() => {
    const totalPasses = passes.length;
    const activePasses = passes.filter(p => p.status === 'OPEN').length;
    const closedPasses = passes.filter(p => p.status === 'CLOSED');
    
    const totalDuration = closedPasses.reduce((sum, pass) => {
      const duration = pass.durationMinutes || 0;
      return sum + duration;
    }, 0);
    
    const averageDuration = closedPasses.length > 0 ? totalDuration / closedPasses.length : 0;
    
    // Count overdue and escalated passes (this would need to be calculated based on your notification logic)
    const overduePasses = passes.filter(p => {
      // This is a simplified check - you'd want to use your actual escalation logic
      return p.status === 'OPEN' && (p.durationMinutes || 0) > 30; // Example: 30 minutes
    }).length;
    
    const escalatedPasses = passes.filter(p => {
      // This is a simplified check - you'd want to use your actual escalation logic
      return p.status === 'OPEN' && (p.durationMinutes || 0) > 60; // Example: 60 minutes
    }).length;
    
    const uniqueStudents = new Set(passes.map(p => p.studentId)).size;
    
    // Fix: Simplify unique locations calculation for JSDOM compatibility
    const allLocationIds: string[] = [];
    passes.forEach(p => {
      p.legs.forEach(l => {
        allLocationIds.push(l.originLocationId);
        allLocationIds.push(l.destinationLocationId);
      });
    });
    const uniqueLocations = new Set(allLocationIds).size;

    return {
      totalPasses,
      activePasses,
      averageDuration,
      overduePasses,
      escalatedPasses,
      uniqueStudents,
      uniqueLocations
    };
  }, [passes]);

  // Filter passes based on current filters
  const filteredPasses = useMemo(() => {
    return passes.filter(pass => {
      // Search term filter
      if (searchTerm) {
        const student = students.find(s => s.id === pass.studentId);
        const studentName = (student?.firstName && student?.lastName ? 
          `${student.firstName} ${student.lastName}` : student?.name || '').toLowerCase();
        const studentEmail = student?.email?.toLowerCase() || '';
        const searchLower = searchTerm.toLowerCase();
        
        if (!studentName.includes(searchLower) && !studentEmail.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && pass.status !== statusFilter) {
        return false;
      }

      // Location filter
      if (locationFilter !== 'all') {
        const hasLocation = pass.legs.some(leg => 
          leg.originLocationId === locationFilter || leg.destinationLocationId === locationFilter
        );
        if (!hasLocation) {
          return false;
        }
      }

      // Date range filter
      if (dateRange !== 'all') {
        const passDate = new Date(pass.createdAt);
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;

        switch (dateRange) {
          case 'today':
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (passDate < today) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - oneWeek);
            if (passDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - oneMonth);
            if (passDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }, [passes, students, searchTerm, statusFilter, locationFilter, dateRange]);

  const handleExport = () => {
    if (onExport) {
      onExport(filteredPasses);
    } else {
      // Gate browser-only DOM manipulation for JSDOM compatibility
      if (typeof window === 'undefined') {
        console.log('Export would be triggered with', filteredPasses.length, 'passes');
        return;
      }

      // Default export behavior
      const csvData = filteredPasses.map(pass => {
        const student = students.find(s => s.id === pass.studentId);
        return {
          'Pass ID': pass.id,
          'Student Name': (student?.firstName && student?.lastName ? 
            `${student.firstName} ${student.lastName}` : student?.name || 'Unknown'),
          'Student Email': student?.email || 'Unknown',
          'Status': pass.status,
          'Duration (minutes)': pass.durationMinutes || 0,
          'Created': new Date(pass.createdAt).toISOString(),
          'Last Updated': new Date(pass.lastUpdatedAt).toISOString(),
        };
      });

      const csv = [
        Object.keys(csvData[0] || {}).join(','),
        ...csvData.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        {/* Temporarily comment out Button to isolate JSDOM issue */}
        {/* <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div> */}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Passes</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalPasses}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activePasses} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.averageDuration)}</div>
            <p className="text-xs text-muted-foreground">
              Per completed pass
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.uniqueStudents}</div>
            <p className="text-xs text-muted-foreground">
              Unique students with passes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.uniqueLocations}</div>
            <p className="text-xs text-muted-foreground">
              Unique locations visited
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert Cards for Issues */}
      {(metrics.overduePasses > 0 || metrics.escalatedPasses > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.overduePasses > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-800">
                  Overdue Passes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-800">{metrics.overduePasses}</div>
                <p className="text-xs text-orange-600">
                  Passes exceeding normal duration
                </p>
              </CardContent>
            </Card>
          )}

          {metrics.escalatedPasses > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-800">
                  Escalated Passes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-800">{metrics.escalatedPasses}</div>
                <p className="text-xs text-red-600">
                  Passes requiring immediate attention
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search Students</label>
              <Input
                placeholder="Name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredPasses.length} of {passes.length} passes
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setLocationFilter('all');
                setDateRange('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      {children && (
        <Card>
          <CardContent className="pt-6">
            {children}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 