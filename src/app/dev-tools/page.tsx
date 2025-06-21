"use client";

import { useState } from "react";
import { mockUsers, mockLocations } from "@/lib/mockData";
import { writeBatch, getFirestore, doc } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dataIngestionService, CSV_SCHEMAS, IngestionResult } from '@/lib/dataIngestionService';

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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvType, setCsvType] = useState<keyof typeof CSV_SCHEMAS>('users');
  const [csvStatus, setCsvStatus] = useState<string>('');
  const [csvResult, setCsvResult] = useState<IngestionResult | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

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
      users.forEach((user: Record<string, unknown>) => {
        if (!user.id || typeof user.id !== 'string') {
          throw new Error("A user object is missing a string 'id' field.");
        }
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
      locations.forEach((loc: Record<string, unknown>) => {
        if (!loc.id || typeof loc.id !== 'string') {
          throw new Error("A location object is missing a string 'id' field.");
        }
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

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setCsvStatus('Please select a CSV file.');
      return;
    }
    setCsvLoading(true);
    setCsvStatus('Processing CSV...');
    setCsvResult(null);
    try {
      const text = await csvFile.text();
      const csvData = dataIngestionService.parseCSV(text);
      const schema = CSV_SCHEMAS[csvType];
      // Validate first
      const validation = dataIngestionService.validateCSV(csvData, schema);
      if (!validation.success) {
        setCsvStatus('Validation failed. See errors below.');
        setCsvResult(validation);
        setCsvLoading(false);
        return;
      }
      // Ingest
      let result: IngestionResult;
      switch (csvType) {
        case 'users':
          result = await dataIngestionService.ingestUsers(csvData);
          break;
        case 'locations':
          result = await dataIngestionService.ingestLocations(csvData);
          break;
        case 'groups':
          result = await dataIngestionService.ingestGroups(csvData);
          break;
        case 'autonomyMatrix':
          result = await dataIngestionService.ingestAutonomyMatrix(csvData);
          break;
        case 'restrictions':
          result = await dataIngestionService.ingestRestrictions(csvData);
          break;
        default:
          throw new Error('Unknown CSV type');
      }
      setCsvResult(result);
      setCsvStatus(result.success ? 'Ingestion successful!' : 'Ingestion completed with errors.');
    } catch (err) {
      setCsvStatus('Error: ' + (err as Error).message);
    }
    setCsvLoading(false);
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

      <Card>
        <CardHeader>
          <CardTitle>Bulk CSV Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <input
              type="file"
              accept=".csv"
              onChange={e => setCsvFile(e.target.files?.[0] || null)}
              className=""
            />
            <select
              value={csvType}
              onChange={e => setCsvType(e.target.value as keyof typeof CSV_SCHEMAS)}
              className="border rounded p-2"
            >
              {Object.keys(CSV_SCHEMAS).map(type => (
                <option key={type} value={type}>{CSV_SCHEMAS[type].name}</option>
              ))}
            </select>
            <Button onClick={handleCsvUpload} disabled={csvLoading}>
              {csvLoading ? 'Uploading...' : 'Upload CSV'}
            </Button>
          </div>
          {csvStatus && (
            <div className={`text-sm ${csvStatus.includes('Error') || csvStatus.includes('failed') ? 'text-destructive' : 'text-green-500'}`}>{csvStatus}</div>
          )}
          {csvResult && (
            <div className="mt-4">
              <div className="font-semibold mb-2">Audit Summary:</div>
              <pre className="bg-muted/50 p-2 rounded text-xs whitespace-pre-wrap">
                {JSON.stringify(csvResult.auditRecord, null, 2)}
              </pre>
              {csvResult.errors.length > 0 && (
                <div className="mt-2">
                  <div className="font-semibold text-destructive mb-1">Errors:</div>
                  <ul className="list-disc pl-5 text-xs">
                    {csvResult.errors.map((err, i) => (
                      <li key={i}>
                        Row {err.row}, Field: {err.field} - {err.message} {err.value !== undefined ? ` (Value: ${String(err.value)})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 