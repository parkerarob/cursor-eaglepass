import { useState, useEffect } from 'react';
import { Location, PassFormData } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAvailableDestinations, getClassroomDestinationsWithTeachers } from '@/lib/firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreatePassFormProps {
  onCreatePass: (formData: PassFormData) => void;
  isLoading?: boolean;
  excludeLocationId?: string;
  heading?: string;
}

export function CreatePassForm({ onCreatePass, isLoading = false, excludeLocationId, heading }: CreatePassFormProps) {
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [availableDestinations, setAvailableDestinations] = useState<Location[]>([]);
  const [classroomDestinations, setClassroomDestinations] = useState<Location[]>([]);

  useEffect(() => {
    const fetchDests = async () => {
      let [destinations, classrooms] = await Promise.all([
        getAvailableDestinations(),
        getClassroomDestinationsWithTeachers()
      ]);
      
      if (excludeLocationId) {
        destinations = destinations.filter(loc => loc.id !== excludeLocationId);
        classrooms = classrooms.filter(loc => loc.id !== excludeLocationId);
      }
      
      setAvailableDestinations(destinations);
      setClassroomDestinations(classrooms);
    };
    fetchDests();
  }, [excludeLocationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDestination && !isLoading) {
      onCreatePass({ destinationLocationId: selectedDestination });
      setSelectedDestination(''); // Reset form
    }
  };

  const getLocationIcon = (locationType: Location['locationType']) => {
    switch (locationType) {
      case 'bathroom':
        return '🚻';
      case 'nurse':
        return '🏥';
      case 'office':
        return '🏢';
      case 'library':
        return '📚';
      case 'cafeteria':
        return '🍽️';
      case 'classroom':
        return '🏫';
      default:
        return '📍';
    }
  };

  const renderClassroomDropdown = () => {
    if (classroomDestinations.length === 0) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Visit Another Classroom</h3>
        <Select onValueChange={(value) => setSelectedDestination(value)} value={selectedDestination}>
          <SelectTrigger>
            <SelectValue placeholder="Select a classroom..." />
          </SelectTrigger>
          <SelectContent>
            {classroomDestinations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.teacherName} | {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderDestinationButtons = (destinations: Location[], sectionTitle: string) => {
    if (destinations.length === 0) return null;
    
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">{sectionTitle}</h3>
        <div className="grid grid-cols-2 gap-3">
          {destinations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => !isLoading && onCreatePass({ destinationLocationId: location.id })}
              className={`
                p-4 rounded-lg border-2 transition-all duration-200 text-left
                border-border hover:border-primary/50 hover:bg-accent/50
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={isLoading}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getLocationIcon(location.locationType)}</span>
                <div>
                  <p className="font-medium">{location.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {location.locationType}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">{heading || `Where are you going?`}</CardTitle>
      </CardHeader>
      <CardContent>
        {(availableDestinations.length > 0 || classroomDestinations.length > 0) ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {renderDestinationButtons(availableDestinations, "Visit Another Location")}
            {renderClassroomDropdown()}
            {classroomDestinations.length > 0 && (
              <Button
                type="submit"
                className="w-full"
                disabled={!selectedDestination || isLoading}
              >
                {isLoading ? 'Creating Pass...' : 'Create Pass'}
              </Button>
            )}
          </form>
        ) : (
          <div className="text-center text-muted-foreground p-4">
            <p>No available destinations found.</p>
            <p className="text-xs mt-2">
              (This may be due to current restrictions or missing location data in Firestore.)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 