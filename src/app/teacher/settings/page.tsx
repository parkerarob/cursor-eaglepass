"use client";

import { useState, useEffect } from 'react';
import { useRole } from '@/components/RoleProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateUser } from '@/lib/firebase/firestore';
import { User } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  getClassroomPolicy,
  updateClassroomPolicy,
  getStudentPolicyOverrides,
  getUsers,
  createStudentPolicyOverride,
  updateStudentPolicyOverride,
  deleteStudentPolicyOverride,
} from '@/lib/firebase/firestore';
import { ClassroomPolicy, StudentPolicyOverride, AutonomyType } from '@/types/policy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function TeacherSettingsPage() {
  const { currentUser, setCurrentUser } = useRole();
  const router = useRouter();
  const [name, setName] = useState(currentUser?.name || '');
  const [roomNumber, setRoomNumber] = useState(currentUser?.assignedLocationId || '');
  const [schoolId, setSchoolId] = useState(currentUser?.schoolId || '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // State for Classroom Policy
  const [policy, setPolicy] = useState<ClassroomPolicy | null>(null);
  const [overrides, setOverrides] = useState<StudentPolicyOverride[]>([]);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  // State for override dialog
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [editingOverride, setEditingOverride] = useState<StudentPolicyOverride | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setRoomNumber(currentUser.assignedLocationId || '');
      setSchoolId(currentUser.schoolId || '');
    }
  }, [currentUser]);

  // Fetch Classroom Policy, Overrides, and Students
  useEffect(() => {
    if (!currentUser?.assignedLocationId) return;

    const fetchPolicyData = async () => {
      setIsLoadingPolicy(true);
      try {
        const [classroomPolicy, studentOverrides, students] = await Promise.all([
          getClassroomPolicy(currentUser.assignedLocationId!),
          getStudentPolicyOverrides(currentUser.assignedLocationId!),
          getUsers(),
        ]);
        
        setPolicy(classroomPolicy);
        setOverrides(studentOverrides);
        setAllStudents(students.filter(u => u.role === 'student'));

      } catch (err) {
        setError('Failed to fetch policy data.');
        console.error(err);
      } finally {
        setIsLoadingPolicy(false);
      }
    };

    fetchPolicyData();
  }, [currentUser?.assignedLocationId]);

  const handleProfileUpdate = async () => {
    if (!currentUser) return;
    setStatus('Updating profile...');
    setError('');

    try {
      const updatedUser: Partial<User> = { 
        name,
        assignedLocationId: roomNumber,
        schoolId,
      };
      await updateUser(currentUser.id, updatedUser);
      
      // Update local state in RoleProvider
      const refreshedUser = { ...currentUser, ...updatedUser };
      setCurrentUser(refreshedUser);

      setStatus('Profile updated successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to update profile: ${errorMessage}`);
      setStatus('');
    }
  };

  const handlePolicyChange = async (rule: keyof ClassroomPolicy['rules'], value: AutonomyType) => {
    if (!currentUser?.assignedLocationId) return;
    setIsSavingPolicy(true);
    
    const newRules = {
      ...policy?.rules,
      [rule]: value,
    };

    // Ensure all rules are defined before saving
    const fullPolicy: ClassroomPolicy['rules'] = {
      studentLeave: newRules.studentLeave || 'Allow',
      studentArrive: newRules.studentArrive || 'Allow',
      teacherRequest: newRules.teacherRequest || 'Allow',
    };

    try {
      await updateClassroomPolicy(currentUser.assignedLocationId, { 
        ownerId: currentUser.id,
        rules: fullPolicy
      });
      // Optimistically update local state
      setPolicy(prev => ({
        ...prev!,
        id: currentUser.assignedLocationId!,
        locationId: currentUser.assignedLocationId!,
        ownerId: currentUser.id,
        rules: fullPolicy,
      }));
    } catch (err) {
      setError('Failed to update policy.');
      console.error(err);
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const handleSaveOverride = async (overrideData: Omit<StudentPolicyOverride, 'id' | 'locationId' | 'ownerId'>) => {
    if (!currentUser?.assignedLocationId) return;

    const dataToSave = {
      ...overrideData,
      locationId: currentUser.assignedLocationId,
      ownerId: currentUser.id,
    };

    try {
      if (editingOverride) {
        // Update existing override
        await updateStudentPolicyOverride(editingOverride.id, dataToSave);
        setOverrides(overrides.map(o => o.id === editingOverride.id ? { ...o, ...dataToSave } : o));
      } else {
        // Create new override
        const newId = await createStudentPolicyOverride(dataToSave);
        setOverrides([...overrides, { ...dataToSave, id: newId }]);
      }
      setIsOverrideDialogOpen(false);
      setEditingOverride(null);
    } catch (err) {
      setError('Failed to save override.');
      console.error(err);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    try {
      await deleteStudentPolicyOverride(overrideId);
      setOverrides(overrides.filter(o => o.id !== overrideId));
      setIsOverrideDialogOpen(false);
    } catch (err) {
      setError('Failed to delete override.');
      console.error(err);
    }
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => router.push('/teacher')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Room Number</label>
            <Input 
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">School ID</label>
            <Input 
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input 
              value={currentUser.email}
              disabled
              className="mt-1 bg-muted/50"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={handleProfileUpdate}>Save Changes</Button>
            <Link href="/teacher" passHref>
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
          {status && <p className="text-sm text-green-500 mt-2">{status}</p>}
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* Classroom Policy Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Classroom Policy</CardTitle>
          <p className="text-sm text-muted-foreground">Set the default pass rules for your classroom.</p>
        </CardHeader>
        <CardContent>
          {isLoadingPolicy ? (
            <p>Loading policy...</p>
          ) : (
            <div className="space-y-4">
              <PolicyRow 
                label="Students who want to leave my classroom..."
                value={policy?.rules?.studentLeave || 'Allow'}
                onValueChange={(value) => handlePolicyChange('studentLeave', value)}
              />
              <PolicyRow 
                label="Students who want to come to my classroom..."
                value={policy?.rules?.studentArrive || 'Allow'}
                onValueChange={(value) => handlePolicyChange('studentArrive', value)}
              />
              <PolicyRow 
                label="Teachers who request a student from my classroom..."
                value={policy?.rules?.teacherRequest || 'Allow'}
                onValueChange={(value) => handlePolicyChange('teacherRequest', value)}
              />
            </div>
          )}
          {isSavingPolicy && <p className="text-sm text-muted-foreground mt-2">Saving...</p>}
        </CardContent>
      </Card>

      {/* Student Overrides Card */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Student-Specific Overrides</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Override the default classroom policy for specific students.</p>
            </div>
            <Button onClick={() => { setEditingOverride(null); setIsOverrideDialogOpen(true); }}>Add Override</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPolicy ? (
            <p>Loading overrides...</p>
          ) : (
            <div className="space-y-2">
              {overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">No overrides created yet.</p>
              ) : (
                overrides.map(override => {
                  const student = allStudents.find(s => s.id === override.studentId);
                  const ruleEntries = Object.entries(override.rules) as [keyof StudentPolicyOverride['rules'], AutonomyType][];
                  return (
                    <div key={override.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div>
                        <p className="font-semibold">{student?.name || 'Unknown Student'}</p>
                        {ruleEntries.map(([rule, value]) => (
                           <p key={rule} className="text-sm text-muted-foreground">
                             {rule.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: <span className="font-medium text-primary">{value}</span>
                           </p>
                        ))}
                      </div>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingOverride(override); setIsOverrideDialogOpen(true); }}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteOverride(override.id)}>Delete</Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {isOverrideDialogOpen && (
        <OverrideDialog
          isOpen={isOverrideDialogOpen}
          onClose={() => setIsOverrideDialogOpen(false)}
          onSave={handleSaveOverride}
          onDelete={handleDeleteOverride}
          existingOverride={editingOverride}
          students={allStudents}
          classroomPolicy={policy}
        />
      )}
    </div>
  );
}

// Helper component for a policy row
function PolicyRow({ label, value, onValueChange }: { label: string, value: AutonomyType, onValueChange: (value: AutonomyType) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="w-[200px]">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Allow">Allowed</SelectItem>
            <SelectItem value="Require Approval">Manual Approval</SelectItem>
            <SelectItem value="Disallow">Not Allowed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function OverrideDialog({ isOpen, onClose, onSave, onDelete, existingOverride, students, classroomPolicy }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<StudentPolicyOverride, 'id'|'locationId'|'ownerId'>) => void;
  onDelete: (id: string) => void;
  existingOverride: StudentPolicyOverride | null;
  students: User[];
  classroomPolicy: ClassroomPolicy | null;
}) {
  const [studentId, setStudentId] = useState(existingOverride?.studentId || '');
  const [leaveRule, setLeaveRule] = useState<AutonomyType | 'default'>(existingOverride?.rules.studentLeave ? existingOverride.rules.studentLeave : 'default');
  const [arriveRule, setArriveRule] = useState<AutonomyType | 'default'>(existingOverride?.rules.studentArrive ? existingOverride.rules.studentArrive : 'default');

  const handleSave = () => {
    const rules: Partial<StudentPolicyOverride['rules']> = {};
    if (leaveRule !== 'default') rules.studentLeave = leaveRule;
    if (arriveRule !== 'default') rules.studentArrive = arriveRule;
    
    if (studentId && Object.keys(rules).length > 0) {
      onSave({ 
        studentId, 
        rules,
        lastUpdatedAt: new Date()
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingOverride ? 'Edit' : 'Add'} Student Override</DialogTitle>
          <DialogDescription>
            Select a student and specify rules that differ from the classroom default.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="student" className="text-right">Student</Label>
            <Select onValueChange={setStudentId} defaultValue={studentId} disabled={!!existingOverride}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent id="student">
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <OverrideRuleRow
            label="Leaving the room"
            value={leaveRule}
            onValueChange={setLeaveRule}
            defaultValue={classroomPolicy?.rules.studentLeave}
          />
          <OverrideRuleRow
            label="Arriving to the room"
            value={arriveRule}
            onValueChange={setArriveRule}
            defaultValue={classroomPolicy?.rules.studentArrive}
          />
        </div>
        <DialogFooter>
          {existingOverride && (
            <Button variant="destructive" onClick={() => onDelete(existingOverride.id)}>Delete</Button>
          )}
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverrideRuleRow({ label, value, onValueChange, defaultValue }: {
  label: string;
  value: AutonomyType | 'default';
  onValueChange: (value: AutonomyType | 'default') => void;
  defaultValue?: AutonomyType;
}) {
  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label className="text-right">{label}</Label>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger className="col-span-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Default ({defaultValue || 'Allow'})</SelectItem>
          <SelectItem value="Allow">Allowed</SelectItem>
          <SelectItem value="Require Approval">Manual Approval</SelectItem>
          <SelectItem value="Disallow">Not Allowed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}