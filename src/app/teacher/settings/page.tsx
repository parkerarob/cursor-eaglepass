"use client";

import { useState, useEffect } from 'react';
import { useRole } from '@/components/RoleProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateUser } from '@/lib/firebase/firestore';
import { User } from '@/types';

export default function TeacherSettingsPage() {
  const { currentUser, setCurrentUser } = useRole();
  const [name, setName] = useState(currentUser?.name || '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
    }
  }, [currentUser]);

  const handleProfileUpdate = async () => {
    if (!currentUser) return;
    setStatus('Updating profile...');
    setError('');

    try {
      const updatedUser: Partial<User> = { name };
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
            <label className="text-sm font-medium">Email</label>
            <Input 
              value={currentUser.email}
              disabled
              className="mt-1 bg-muted/50"
            />
          </div>
          <Button onClick={handleProfileUpdate}>Save Changes</Button>
          {status && <p className="text-sm text-green-500 mt-2">{status}</p>}
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
} 