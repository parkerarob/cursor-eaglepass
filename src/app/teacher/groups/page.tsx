"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRole } from '@/components/RoleProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getGroupsByOwner,
  getAllStudents,
  createGroup,
  updateGroup,
  deleteGroup,
} from '@/lib/firebase/firestore';
import { Group } from '@/types/policy';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { User } from '@/types';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TeacherGroupsPage() {
  const { currentUser } = useRole();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for the Group-Editing Dialog
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Partial<Group>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [allStudents, setAllStudents] = useState<User[]>([]);

  const fetchGroups = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const userGroups = await getGroupsByOwner(currentUser.id);
      setGroups(userGroups);
    } catch (err) {
      setError('Failed to fetch groups.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchData = async () => {
      try {
        const students = await getAllStudents();
        setAllStudents(students);
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        setError("Failed to load required data for the page.");
      }
    };

    fetchGroups();
    fetchData();
  }, [currentUser, fetchGroups]);

  const handleSaveGroup = async () => {
    if (!currentUser || !currentGroup?.name || !currentGroup?.groupType) {
      setError("Group name and type are required.");
      return;
    }
    setError(null);

    try {
      if (isEditing) {
        await updateGroup(currentGroup.id!, {
          name: currentGroup.name,
          groupType: currentGroup.groupType,
          assignedStudents: currentGroup.assignedStudents,
          description: currentGroup.description,
          lastUpdatedAt: new Date(),
        });
      } else {
        const newGroup: Omit<Group, 'id'> = {
          name: currentGroup.name,
          groupType: currentGroup.groupType,
          ownerId: currentUser.id,
          assignedStudents: currentGroup.assignedStudents || [],
          description: currentGroup.description || '',
          createdAt: new Date(),
          lastUpdatedAt: new Date(),
        };
        await createGroup(newGroup);
      }
      await fetchGroups();
      setIsGroupDialogOpen(false);
    } catch (err) {
      setError('Failed to save group.');
      console.error(err);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    try {
      await deleteGroup(groupId);
      await fetchGroups();
    } catch (err) {
      setError('Failed to delete group.');
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Groups</h1>
        <Link href="/teacher">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Group Management</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading groups...</p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div>
                    <p className="font-semibold">{group.name} <span className="text-sm text-muted-foreground">({group.groupType})</span></p>
                    <p className="text-sm text-muted-foreground">{group.assignedStudents.length} student(s)</p>
                  </div>
                  <div className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setIsEditing(true);
                      setCurrentGroup(group);
                      setIsGroupDialogOpen(true);
                    }}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteGroup(group.id)}>Delete</Button>
                  </div>
                </div>
              ))}
              <Button onClick={() => {
                setIsEditing(false);
                setCurrentGroup({ assignedStudents: [] });
                setIsGroupDialogOpen(true);
              }}>Create New Group</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Group Editing Dialog */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Group' : 'Create Group'}</DialogTitle>
            <DialogDescription>
              Manage your student group. Add or remove members and set the group type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={currentGroup?.name || ''} onChange={(e) => setCurrentGroup({...currentGroup, name: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Type</Label>
              <Select value={currentGroup?.groupType} onValueChange={(value: 'Positive' | 'Negative') => setCurrentGroup({...currentGroup, groupType: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a group type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Positive">Positive</SelectItem>
                  <SelectItem value="Negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="students" className="text-right">Students</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="col-span-3 justify-between">
                    {currentGroup?.assignedStudents?.length || 0} selected
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search students..." />
                    <CommandList>
                      <CommandEmpty>No students found.</CommandEmpty>
                      <CommandGroup>
                        {allStudents.map((student) => (
                          <CommandItem
                            key={student.id}
                            value={student.name}
                            onSelect={() => {
                              const selected = currentGroup.assignedStudents || [];
                              const isSelected = selected.includes(student.id);
                              const newSelected = isSelected
                                ? selected.filter((id) => id !== student.id)
                                : [...selected, student.id];
                              setCurrentGroup({ ...currentGroup, assignedStudents: newSelected });
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", (currentGroup.assignedStudents || []).includes(student.id) ? "opacity-100" : "opacity-0")} />
                            {student.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup}>Save Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 