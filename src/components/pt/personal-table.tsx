'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { collection, query, where, orderBy, doc, addDoc } from 'firebase/firestore';
import { useFirebase, useCollection } from '@/firebase';
import type { PTSession, PersonalTableEntry, PTTrainer, PTPackage } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, BookOpen, Edit, Plus } from 'lucide-react';
import { PersonalTableForm } from './personal-table-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

// Props interface for the main component
interface PersonalTableProps {
  clientId: string;
  trainers: PTTrainer[];
  packages: PTPackage[];
  sessions: PTSession[];
}

// Props for an existing session item
interface ExistingSessionItemProps {
    session: PTSession;
    trainers: PTTrainer[];
    sessionNumber: number;
}

// Props for a planned session item
interface PlannedSessionItemProps {
    pkg: PTPackage;
    clientId: string;
    sessionNumber: number;
}

// Helper to format date and time
const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'Date not set';
    return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

// Component to display a single workout's details
function SessionWorkout({ session, trainerName }: { session: PTSession, trainerName: string }) {
    const { firestore } = useFirebase();
    const [isEditing, setIsEditing] = useState(false);

    const personalTableQuery = useMemo(() => firestore ? query(collection(firestore, `pt_sessions/${session.id}/personalTable`)) : null, [firestore, session.id]);
    const { data: personalTableEntries, isLoading } = useCollection<PersonalTableEntry>(personalTableQuery);
    
    const personalTable = useMemo(() => personalTableEntries?.[0], [personalTableEntries]);
    
    if (isLoading) {
        return <div className="p-4 flex justify-center"><Loader2 className="animate-spin" /></div>;
    }

    if (isEditing || !personalTable) {
        return (
            <div className="p-4 bg-slate-100/50">
                <PersonalTableForm
                    session={session}
                    existingTable={personalTable}
                    onSave={() => setIsEditing(false)}
                    onCancel={() => setIsEditing(false)}
                />
            </div>
        );
    }
    
    return (
        <div className="p-4 bg-slate-100/50 space-y-4">
             <div className="flex justify-between items-start">
                 <div>
                    {personalTable.focus && <Badge>{personalTable.focus}</Badge>}
                    <p className="text-xs text-muted-foreground mt-2">Trainer: {trainerName}</p>
                 </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}><Edit className="mr-2 h-3 w-3"/>Edit</Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="p-2 text-left font-semibold">Exercise</th>
                            <th className="p-2 text-left font-semibold">Sets</th>
                            <th className="p-2 text-left font-semibold">Reps</th>
                            <th className="p-2 text-left font-semibold">Weight</th>
                            <th className="p-2 text-left font-semibold">Rest</th>
                        </tr>
                    </thead>
                    <tbody>
                        {personalTable.exercises.map((ex, index) => (
                            <tr key={index} className="border-b last:border-b-0">
                                <td className="p-2">{ex.name}</td>
                                <td className="p-2">{ex.sets || '-'}</td>
                                <td className="p-2">{ex.reps || '-'}</td>
                                <td className="p-2">{ex.weight || '-'}</td>
                                <td className="p-2">{ex.rest || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {personalTable.trainerNotes && (
                <div>
                    <h5 className="font-semibold text-xs text-muted-foreground">Trainer Notes</h5>
                    <p className="text-sm p-2 bg-white rounded-md border">{personalTable.trainerNotes}</p>
                </div>
            )}
             {personalTable.clientFeedback && (
                <div>
                    <h5 className="font-semibold text-xs text-muted-foreground">Client Feedback</h5>
                    <p className="text-sm p-2 bg-white rounded-md border">{personalTable.clientFeedback}</p>
                </div>
            )}
        </div>
    );
}

// Component for an existing session
function ExistingSessionItem({ session, trainers, sessionNumber }: ExistingSessionItemProps) {
    const trainerName = trainers.find(t => t.id === session.trainer_id)?.name || 'Unassigned';
    
    return (
        <Accordion type="single" collapsible className="w-full bg-white rounded-lg border">
          <AccordionItem value={session.id} className="border-b-0">
            <AccordionTrigger className="p-4 hover:no-underline">
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-primary">Session {sessionNumber}</span>
                      <Badge variant="secondary" className={cn('capitalize')}>{session.session_status}</Badge>
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{session.session_status === 'scheduled' && !session.trainer_id ? "Planned" : formatDateTime(session.session_datetime)}</p>
                        <p className="text-sm text-muted-foreground text-right">with {trainerName}</p>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <SessionWorkout session={session} trainerName={trainerName} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
    );
}

// Component for a planned (not yet created) session
function PlannedSessionItem({ pkg, clientId, sessionNumber }: PlannedSessionItemProps) {
  const { firestore } = useFirebase();
  const [isPending, startTransition] = useTransition();

  const handlePlanWorkout = () => {
    startTransition(async () => {
      if (!firestore) return;
      
      const newSessionData: Partial<PTSession> = {
        client_id: clientId,
        purchase_id: pkg.id,
        session_datetime: new Date().toISOString(),
        duration_hours: 1,
        session_status: 'scheduled',
        trainer_id: '', // Empty trainer ID signifies it's just planned
      };

      await addDoc(collection(firestore, 'pt_sessions'), newSessionData);
    });
  };

  return (
    <div className="flex justify-between items-center p-4 border-2 border-dashed rounded-lg bg-slate-50">
      <div>
        <p className="font-semibold text-slate-600">Session {sessionNumber}</p>
        <p className="text-sm text-muted-foreground">Ready to be planned</p>
      </div>
      <Button onClick={handlePlanWorkout} disabled={isPending} variant="outline" size="sm">
        {isPending ? <Loader2 className="animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Plan Workout
      </Button>
    </div>
  );
}


// Main Component
export function PersonalTable({ clientId, trainers, packages, sessions }: PersonalTableProps) {
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
        <CardDescription>A record of all training sessions per package. Click to expand and plan workouts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full space-y-4">
            {packages.map(pkg => {
                const packageSessions = sessions
                  .filter(s => s.purchase_id === pkg.id)
                  .sort((a, b) => new Date(a.session_datetime).getTime() - new Date(b.session_datetime).getTime()); // sort ascending by date

                const totalSessionCount = Math.floor(pkg.hours_purchased); // Assuming 1 hour = 1 session
                const sessionSlots = Array.from({ length: totalSessionCount }, (_, i) => i);

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
                           {sessionSlots.map((slotIndex) => {
                              const session = packageSessions[slotIndex];
                              if (session) {
                                return <ExistingSessionItem key={session.id} session={session} trainers={trainers} sessionNumber={slotIndex + 1} />;
                              } else {
                                return <PlannedSessionItem key={slotIndex} pkg={pkg} clientId={clientId} sessionNumber={slotIndex + 1} />;
                              }
                           })}
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
