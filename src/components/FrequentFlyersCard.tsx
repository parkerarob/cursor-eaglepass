'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, Users } from 'lucide-react';
import { User } from '@/types';
import { Button } from '@/components/ui/button';

interface FrequentFlyer {
  student: User;
  passCount: number;
}

interface FrequentFlyersCardProps {
  students: FrequentFlyer[];
  title: string;
  description: string;
  timeframe: 'day' | 'week' | 'month' | 'all';
  onTimeframeChange: (timeframe: 'day' | 'week' | 'month' | 'all') => void;
}

const timeframes = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All Time' },
] as const;

export function FrequentFlyersCard({ students, title, description, timeframe, onTimeframeChange }: FrequentFlyersCardProps) {
  const router = useRouter();

  const handleStudentClick = (student: User) => {
    router.push(`/admin/reports/student/${encodeURIComponent(student.name)}`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
            <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
            {timeframes.map((tf) => (
                <Button 
                    key={tf.value}
                    variant={timeframe === tf.value ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => onTimeframeChange(tf.value)}
                    className="h-8 px-3"
                >
                    {tf.label}
                </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No student data to display.</p>
        ) : (
            <div className="space-y-3">
            {students.map(({ student, passCount }) => (
                <div
                key={student.id}
                className="p-3 border rounded-lg cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50"
                onClick={() => handleStudentClick(student)}
                >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center">
                        <UserIcon className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div>
                        <h3 className="font-medium">{student.name}</h3>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                    </div>
                    </div>
                    <div className="text-right">
                    <div className="font-bold text-lg">{passCount}</div>
                    <div className="text-xs text-muted-foreground">passes</div>
                    </div>
                </div>
                </div>
            ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
} 