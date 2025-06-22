'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User as UserIcon, Users } from 'lucide-react';
import { User } from '@/types';

interface FrequentFlyer {
  student: User;
  passCount: number;
}

interface FrequentFlyersCardProps {
  students: FrequentFlyer[];
  title: string;
  description: string;
}

export function FrequentFlyersCard({ students, title, description }: FrequentFlyersCardProps) {
  const router = useRouter();

  const handleStudentClick = (student: User) => {
    router.push(`/admin/reports/student/${encodeURIComponent(student.name)}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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