"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRole } from '@/components/RoleProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateUser } from '@/lib/firebase/firestore';
import { User } from '@/types';
import Link from 'next/link';
import {
  getAutonomyMatrixByLocationId,
  createAutonomyMatrix,
  updateAutonomyMatrix,
  deleteAutonomyMatrix,
  getGroups,
} from '@/lib/firebase/firestore';
import { AutonomyMatrix, Group } from '@/types/policy';
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
  const [name, setName] = useState(currentUser?.name || '');
  const [roomNumber, setRoomNumber] = useState(currentUser?.assignedLocationId || '');
  const [schoolId, setSchoolId] = useState(currentUser?.schoolId || '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // State for Autonomy Rules
  const [autonomyRules, setAutonomyRules] = useState<AutonomyMatrix[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(true);

  // State for the Rule-Editing Dialog
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<Partial<AutonomyMatrix> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setRoomNumber(currentUser.assignedLocationId || '');
      setSchoolId(currentUser.schoolId || '');
    }
  }, [currentUser]);

  const fetchRules = useCallback(async () => {
    if (!currentUser?.assignedLocationId) return;
    setIsLoadingRules(true);
    try {
      const rules = await getAutonomyMatrixByLocationId(currentUser.assignedLocationId!);
      setAutonomyRules(rules);
    } catch (err) {
      setError('Failed to fetch autonomy rules.');
      console.error(err);
    } finally {
      setIsLoadingRules(false);
    }
  }, [currentUser?.assignedLocationId]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groupData = await getGroups();
        setGroups(groupData);
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      }
    };
    fetchRules();
    fetchGroups();
  }, [currentUser?.assignedLocationId, fetchRules]);

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

  const handleSaveRule = async () => {
    if (!currentUser?.assignedLocationId || !currentRule) return;

    try {
      if (isEditing) {
        // Update existing rule
        await updateAutonomyMatrix(currentRule.id!, {
          ...currentRule,
          lastUpdatedAt: new Date(),
        });
      } else {
        // Create new rule
        const newRule: Omit<AutonomyMatrix, 'id'> = {
          locationId: currentUser.assignedLocationId,
          autonomyType: currentRule.autonomyType!,
          groupId: currentRule.groupId,
          description: currentRule.description,
          createdAt: new Date(),
          lastUpdatedAt: new Date(),
        };
        await createAutonomyMatrix(newRule);
      }
      await fetchRules(); // Re-fetch rules to update the list
      setIsRuleDialogOpen(false); // Close the dialog
    } catch (err) {
      setError('Failed to save rule.');
      console.error(err);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await deleteAutonomyMatrix(ruleId);
      await fetchRules(); // Re-fetch rules
    } catch (err) {
      setError('Failed to delete rule.');
      console.error(err);
    }
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
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

      {/* Autonomy Rules Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Classroom Autonomy Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRules ? (
            <p>Loading rules...</p>
          ) : (
            <div className="space-y-4">
              {autonomyRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div>
                    <p className="font-semibold">{rule.autonomyType}</p>
                    <p className="text-sm text-muted-foreground">
                      {groups.find(g => g.id === rule.groupId)?.name || 'All Students'}
                    </p>
                    <p className="text-sm text-muted-foreground">{rule.description || 'No description'}</p>
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setIsEditing(true);
                      setCurrentRule(rule);
                      setIsRuleDialogOpen(true);
                    }}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteRule(rule.id)}>Delete</Button>
                  </div>
                </div>
              ))}
              <Button onClick={() => {
                setIsEditing(false);
                setCurrentRule({});
                setIsRuleDialogOpen(true);
              }}>Add New Rule</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule-Editing Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Rule' : 'Add New Rule'}</DialogTitle>
            <DialogDescription>
              Set the autonomy rule for students in your classroom.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="autonomyType">Rule Type</Label>
              <Select
                value={currentRule?.autonomyType}
                onValueChange={(value: 'Allow' | 'Disallow' | 'Require Approval') => setCurrentRule({ ...currentRule, autonomyType: value })}
              >
                <SelectTrigger id="autonomyType">
                  <SelectValue placeholder="Select a rule type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Allow">Allow</SelectItem>
                  <SelectItem value="Disallow">Disallow</SelectItem>
                  <SelectItem value="Require Approval">Require Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupId">Student Group</Label>
              <Select
                value={currentRule?.groupId || 'all'}
                onValueChange={(value) => setCurrentRule({ ...currentRule, groupId: value === 'all' ? undefined : value })}
              >
                <SelectTrigger id="groupId">
                  <SelectValue placeholder="Select a group (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.groupType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={currentRule?.description || ''}
                onChange={(e) => setCurrentRule({ ...currentRule, description: e.target.value })}
                placeholder="e.g., 'Allowed during lunch'"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule}>Save Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 