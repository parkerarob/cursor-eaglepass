"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pass, User } from "@/types";
import { getLongestPassesByLocationType } from "@/lib/firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Timeframe = 'day' | 'week' | 'month' | 'all';
type StallSitterData = { pass: Pass; student: User; duration: number };

export function StallSitterCard({
  limit = 5,
  locationId,
}: {
  limit?: number;
  locationId?: string;
}) {
  const [data, setData] = useState<StallSitterData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await getLongestPassesByLocationType('bathroom', timeframe, locationId);
        setData(result);
      } catch (error) {
        console.error("Error fetching stall sitters data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeframe, locationId]);

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Stall Sitters</CardTitle>
            <CardDescription>
              Students with the longest bathroom visits.
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {(['day', 'week', 'month', 'all'] as Timeframe[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={timeframe === t ? 'default' : 'outline'}
                onClick={() => handleTimeframeChange(t)}
                className="capitalize"
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading...</p>
        ) : data.length > 0 ? (
          <ol className="space-y-4">
            {data.slice(0, limit).map(({ pass, student, duration }) => (
              <li key={pass.id} className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/admin/reports/student/${student.name}`}
                    className="font-medium hover:underline"
                  >
                    {student.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Pass on {new Date(pass.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="font-bold text-lg">
                  {Math.round(duration)} min
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>No bathroom passes found for the selected timeframe.</p>
        )}
      </CardContent>
    </Card>
  );
} 