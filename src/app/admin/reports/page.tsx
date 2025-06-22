"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, User, Users, Clock, MapPin } from 'lucide-react';
import { getAllStudents, getAllPasses } from '@/lib/firebase/firestore';
import { User as UserType } from '@/types';

interface StudentWithPassCount extends UserType {
  passCount: number;
  lastPassDate?: Date;
}

export default function ReportsPage() {
  const [students, setStudents] = useState<StudentWithPassCount[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithPassCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const allStudents = await getAllStudents();
        const allPasses = await getAllPasses();
        
        // Enrich students with pass information
        const studentsWithPassData = allStudents.map(student => {
          const studentPasses = allPasses.filter(pass => pass.studentId === student.id);
          const lastPass = studentPasses.length > 0 
            ? studentPasses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
            : null;
          
          return {
            ...student,
            passCount: studentPasses.length,
            lastPassDate: lastPass ? new Date(lastPass.createdAt) : undefined,
          };
        });
        
        setStudents(studentsWithPassData);
        setFilteredStudents(studentsWithPassData);
      } catch (error) {
        console.error('Error loading students:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents(students);
    }
  }, [searchQuery, students]);

  const handleStudentClick = (student: StudentWithPassCount) => {
    router.push(`/admin/reports/student/${encodeURIComponent(student.name)}`);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading students...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Reports</h1>
          <p className="text-muted-foreground">
            Click on any student to view their complete pass history and details
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Students
          </CardTitle>
          <CardDescription>
            Filter students by name to find the one you&apos;re looking for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Students List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Students ({filteredStudents.length})
          </CardTitle>
          <CardDescription>
            Click on any student to view their pass history and detailed information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No students found matching your search' : 'No students found'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="p-4 border rounded-lg cursor-pointer transition-colors hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => handleStudentClick(student)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-lg">{student.name}</h3>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{student.passCount} passes</span>
                      </div>
                      {student.lastPassDate && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>Last: {formatDate(student.lastPassDate)}</span>
                        </div>
                      )}
                      <Badge variant="outline">
                        {student.passCount > 0 ? 'Has History' : 'No Passes'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 