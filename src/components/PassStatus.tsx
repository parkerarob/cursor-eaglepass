import { Pass, Location } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLocationById } from '@/lib/mockData';

interface PassStatusProps {
  pass: Pass | null;
  studentName: string;
  currentLocation: Location;
}

export function PassStatus({ pass, studentName, currentLocation }: PassStatusProps) {
  if (!pass) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">No Active Pass</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            You're currently in {currentLocation.name}
          </p>
          <Badge variant="success" className="text-sm">
            IN CLASS
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const destination = getLocationById(pass.destinationLocationId);
  const isOut = pass.state === 'OUT';
  const isOpen = pass.status === 'OPEN';

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Active Pass</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Going to:</p>
          <p className="text-lg font-semibold">{destination?.name}</p>
        </div>

        <div className="flex justify-center gap-2">
          <Badge 
            variant={isOpen ? "info" : "secondary"}
            className="text-sm"
          >
            {isOpen ? "OPEN" : "CLOSED"}
          </Badge>
          <Badge 
            variant={isOut ? "warning" : "success"}
            className="text-sm"
          >
            {isOut ? "OUT" : "IN"}
          </Badge>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Started: {pass.createdAt.toLocaleTimeString()}</p>
          {isOpen && (
            <p className="mt-1">
              {isOut ? "You're on your way" : "You've arrived"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 