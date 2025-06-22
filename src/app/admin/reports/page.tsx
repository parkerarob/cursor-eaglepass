"use client";

import { FrequentFlyersCard } from "@/components/FrequentFlyersCard";
import { StallSitterCard } from "@/components/StallSitterCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StudentSearch } from "@/components/StudentSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminReportsPage = () => {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <Link href="/teacher">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Student Pass History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Select a student to view their complete pass history.
            </p>
            <StudentSearch />
          </CardContent>
        </Card>
        <FrequentFlyersCard title="School-Wide Frequent Flyers" limit={10} />
        <StallSitterCard limit={10} />
      </div>
    </div>
  );
};

export default AdminReportsPage; 