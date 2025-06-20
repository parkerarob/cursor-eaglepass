"use client";

import { useState } from "react";
import { mockUsers, mockLocations } from "@/lib/mockData";
import { writeBatch, getFirestore, doc } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const db = getFirestore(firebaseApp);

function isDev() {
  return process.env.NODE_ENV === "development";
}

export default function DevToolsPage() {
  const [userJson, setUserJson] = useState(JSON.stringify(mockUsers, null, 2));
  const [locationJson, setLocationJson] = useState(
    JSON.stringify(mockLocations, null, 2)
  );
  const [userStatus, setUserStatus] = useState<string>("");
  const [locationStatus, setLocationStatus] = useState<string>("");

  if (!isDev()) {
    return (
      <div className="p-8 text-center">
        Dev tools are only available in development mode.
      </div>
    );
  }

  const uploadUsers = async () => {
    setUserStatus("Uploading users...");
    try {
      const users = JSON.parse(userJson);
      if (!Array.isArray(users)) {
        throw new Error("User data must be a JSON array.");
      }
      const batch = writeBatch(db);
      users.forEach((user: any) => {
        if (!user.id) throw new Error("A user is missing an 'id' field.");
        const ref = doc(db, "users", user.id);
        batch.set(ref, user);
      });
      await batch.commit();
      setUserStatus("Users uploaded successfully!");
    } catch (err) {
      setUserStatus("Error uploading users: " + (err as Error).message);
    }
  };

  const uploadLocations = async () => {
    setLocationStatus("Uploading locations...");
    try {
      const locations = JSON.parse(locationJson);
      if (!Array.isArray(locations)) {
        throw new Error("Location data must be a JSON array.");
      }
      const batch = writeBatch(db);
      locations.forEach((loc: any) => {
        if (!loc.id) throw new Error("A location is missing an 'id' field.");
        const ref = doc(db, "locations", loc.id);
        batch.set(ref, loc);
      });
      await batch.commit();
      setLocationStatus("Locations uploaded successfully!");
    } catch (err) {
      setLocationStatus(
        "Error uploading locations: " + (err as Error).message
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold text-center">
        Dev Tools: Firestore Migration
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full h-64 p-2 font-mono text-sm border rounded-md bg-muted/50"
            value={userJson}
            onChange={(e) => setUserJson(e.target.value)}
          />
          <Button onClick={uploadUsers}>Upload Users</Button>
          {userStatus && (
            <div
              className={`text-sm ${
                userStatus.includes("Error")
                  ? "text-destructive"
                  : "text-green-500"
              }`}
            >
              {userStatus}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full h-64 p-2 font-mono text-sm border rounded-md bg-muted/50"
            value={locationJson}
            onChange={(e) => setLocationJson(e.target.value)}
          />
          <Button onClick={uploadLocations}>Upload Locations</Button>
          {locationStatus && (
            <div
              className={`text-sm ${
                locationStatus.includes("Error")
                  ? "text-destructive"
                  : "text-green-500"
              }`}
            >
              {locationStatus}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 