"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "@/types";
import { getPassCountsByStudent } from "@/lib/firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatUserName } from '@/lib/utils';

type Timeframe = 'day' | 'week' | 'month' | 'all';
type FrequentFlyerData = { student: User; passCount: number };

export function FrequentFlyersCard({
  title,
  limit = 5,
  locationId,
}: {
  title: string;
  limit?: number;
  locationId?: string;
}) {
  const [data, setData] = useState<FrequentFlyerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await getPassCountsByStudent(locationId, timeframe);
        setData(result);
      } catch (error) {
        console.error("Error fetching frequent flyers data:", error);
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
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {locationId ? "Top students from your classes." : "Top students across the school."}
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
            {data.slice(0, limit).map(({ student, passCount }) => (
              <li key={student.id} className="flex items-center justify-between">
                <div>
                  <Link
                    href={`/admin/reports/student/${formatUserName(student)}`}
                    className="font-medium hover:underline"
                  >
                    {formatUserName(student)}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {student.email}
                  </p>
                </div>
                <div className="font-bold text-lg">{passCount}</div>
              </li>
            ))}
          </ol>
        ) : (
          <p>No student pass data found for the selected timeframe.</p>
        )}
      </CardContent>
    </Card>
  );
} 