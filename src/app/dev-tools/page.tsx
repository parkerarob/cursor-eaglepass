"use client";

import { useState } from "react";
import { mockUsers, mockLocations } from "@/lib/mockData";
import { writeBatch, getFirestore, doc } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase/config";

const db = getFirestore(firebaseApp);

function isDev() {
  return process.env.NODE_ENV === "development";
}

export default function DevToolsPage() {
  const [userStatus, setUserStatus] = useState<string>("");
  const [locationStatus, setLocationStatus] = useState<string>("");

  if (!isDev()) {
    return <div className="p-8 text-center">Dev tools are only available in development mode.</div>;
  }

  const uploadUsers = async () => {
    setUserStatus("Uploading users...");
    try {
      const batch = writeBatch(db);
      mockUsers.forEach((user) => {
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
      const batch = writeBatch(db);
      mockLocations.forEach((loc) => {
        const ref = doc(db, "locations", loc.id);
        batch.set(ref, loc);
      });
      await batch.commit();
      setLocationStatus("Locations uploaded successfully!");
    } catch (err) {
      setLocationStatus("Error uploading locations: " + (err as Error).message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Dev Tools: Firestore Migration</h1>
      <div className="space-y-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={uploadUsers}
        >
          Upload Mock Users
        </button>
        <div className="text-sm text-gray-600">{userStatus}</div>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={uploadLocations}
        >
          Upload Mock Locations
        </button>
        <div className="text-sm text-gray-600">{locationStatus}</div>
      </div>
    </div>
  );
} 