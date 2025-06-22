'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn, formatUserName } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { User } from '@/types';
import { getAllStudents } from '@/lib/firebase/firestore';

export function StudentSearch() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [students, setStudents] = useState<User[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchStudents = async () => {
      const allStudents = await getAllStudents();
      setStudents(allStudents);
    };
    fetchStudents();
  }, []);

  const handleSelect = (currentValue: string) => {
    setValue(currentValue);
    setOpen(false);
    router.push(`/admin/reports/student/${encodeURIComponent(currentValue)}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          {value
            ? students.find((student) => formatUserName(student) === value)?.name
            : 'Select a student...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search for a student..." />
          <CommandList>
            <CommandEmpty>No student found.</CommandEmpty>
            <CommandGroup>
              {students.map((student) => (
                <CommandItem
                  key={student.id}
                  value={formatUserName(student)}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === formatUserName(student) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {formatUserName(student)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 