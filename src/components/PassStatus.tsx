import { Pass, Location } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLocationById } from '@/lib/firebase/firestore';
import { useState, useEffect } from 'react';

interface PassStatusProps {
  pass: Pass | null;
  currentLocation: Location;
}

export function PassStatus({ pass, currentLocation }: PassStatusProps) {
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (pass) {
      const lastLeg = pass.legs[pass.legs.length - 1];
      getLocationById(lastLeg.destinationLocationId).then(setDestinationLocation);
    }
  }, [pass]);

  if (!pass) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">No Active Pass</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-4">
            {`You're currently in ${currentLocation.name}`}
          </p>
          <Badge variant="success" className="text-sm" data-testid="location-badge">
            IN CLASS
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const lastLeg = pass.legs[pass.legs.length - 1];
  const isOut = lastLeg.state === 'OUT';
  const isOpen = pass.status === 'OPEN';

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Active Pass</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {isOut ? 'OUT to:' : 'IN'}
          </p>
          <p className="text-lg font-semibold">
            {destinationLocation?.name || 'Loading...'}
          </p>
        </div>

        <div className="flex justify-center gap-2">
          <Badge 
            variant={isOpen ? "info" : "secondary"}
            className="text-sm"
            data-testid="status-badge"
          >
            {isOpen ? "OPEN" : "CLOSED"}
          </Badge>
          <Badge 
            variant={isOut ? "warning" : "success"}
            className="text-sm"
            data-testid="state-badge"
          >
            {isOut ? "OUT" : "IN"}
          </Badge>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>{isOut ? `Started` : `Arrived`}: {lastLeg.timestamp.toLocaleTimeString()}</p>
          {isOpen && (
            <p className="mt-1">
              {isOut ? `You're on your way` : `You've arrived`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 