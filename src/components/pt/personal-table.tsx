'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { PTPackage, PTWorkout } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, BookOpen, Edit } from 'lucide-react';
import { WorkoutForm } from './personal-table-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Props interface for the main component
interface PersonalTableProps {
  clientId: string;
  packages: PTPackage[];
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};


function WorkoutAccordion({ sessionNumber, pkg, clientId }: { sessionNumber: number, pkg: PTPackage, clientId: string }) {
    const { firestore } = useFirebase();
    const [isEditing, setIsEditing] = useState(false);
    
    // We fetch the specific workout doc here to ensure real-time updates within the accordion
    const workoutQuery = useMemoFirebase(
      () => (firestore ? query(collection(firestore, 'pt_workouts'), where('packageId', '==', pkg.id), where('sessionNumber', '==', sessionNumber)) : null),
      [firestore, pkg.id, sessionNumber]
    );
    const { data: workoutData, isLoading } = useCollection<PTWorkout>(workoutQuery);
    const existingWorkout = useMemo(() => (workoutData && workoutData.length > 0 ? workoutData[0] : null), [workoutData]);

    if (isLoading) {
        return <div className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto"/></div>
    }

    if (isEditing) {
        return (
            <div className="p-4 bg-slate-100/50">
                <WorkoutForm
                    clientId={clientId}
                    packageId={pkg.id}
                    sessionNumber={sessionNumber}
                    existingWorkout={existingWorkout}
                    onSave={() => setIsEditing(false)}
                    onCancel={() => setIsEditing(false)}
                />
            </div>
        );
    }
    
    return (
        <div className="p-4 text-sm">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <p><strong>Date:</strong> {formatDate(existingWorkout?.date)}</p>
                    <p><strong>Focus:</strong> {existingWorkout?.focus || 'Not set'}</p>
                     {existingWorkout?.exercises && existingWorkout.exercises.length > 0 && (
                        <div>
                            <strong>Exercises:</strong>
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                {existingWorkout.exercises.map((ex, i) => (
                                    <li key={i}>{ex.name} ({ex.sets || '...'} sets, {ex.reps || '...'} reps)</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
            </div>
        </div>
    );
}

// Main Component
export function PersonalTable({ clientId, packages }: PersonalTableProps) {
  if (!packages || packages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen className="w-6 h-6"/>Personal Table / Workout History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No packages found for this client.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="w-6 h-6"/>Personal Table / Workout History</CardTitle>
        <CardDescription>A record of all training sessions per package. Click to expand and record workout details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full space-y-4">
            {packages.map(pkg => {
                const totalSessionCount = Math.floor(pkg.hours_purchased);
                const sessionSlots = Array.from({ length: totalSessionCount }, (_, i) => i + 1);

                return (
                  <AccordionItem value={pkg.id} key={pkg.id} className="border-b-0">
                    <AccordionTrigger className="p-4 rounded-lg border bg-white hover:bg-slate-50 hover:no-underline">
                        <div className="flex justify-between items-center w-full">
                            <div>
                                <p className="font-bold text-lg">{pkg.package_name}</p>
                                <p className="text-sm text-muted-foreground">{pkg.hours_used} / {pkg.hours_purchased} hours used</p>
                            </div>
                             <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'} className={cn(
                                'capitalize',
                                pkg.status === 'active' && 'bg-green-100 text-green-800',
                                pkg.status === 'completed' && 'bg-blue-100 text-blue-800',
                                pkg.status === 'expired' && 'bg-red-100 text-red-800'
                             )}>{pkg.status}</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <div className="space-y-2 p-2 bg-slate-50 rounded-b-lg">
                           {sessionSlots.map((sessionNumber) => (
                             <Accordion key={sessionNumber} type="single" collapsible className="w-full bg-white rounded-lg border">
                               <AccordionItem value={`session-${sessionNumber}`} className="border-b-0">
                                 <AccordionTrigger className="p-4 hover:no-underline [&[data-state=open]]:border-b">
                                   <div className="flex justify-between items-center w-full">
                                     <span className="font-semibold text-primary">Session {sessionNumber}</span>
                                   </div>
                                 </AccordionTrigger>
                                 <AccordionContent>
                                    <WorkoutAccordion
                                        sessionNumber={sessionNumber}
                                        pkg={pkg}
                                        clientId={clientId}
                                    />
                                 </AccordionContent>
                               </AccordionItem>
                             </Accordion>
                           ))}
                        </div>
                    </AccordionContent>
                  </AccordionItem>
                );
            })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
    