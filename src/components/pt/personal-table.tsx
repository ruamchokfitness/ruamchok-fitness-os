'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { PTSession, PersonalTableEntry, PTTrainer, PTPackage } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, BookOpen } from 'lucide-react';
import { PersonalTableForm } from './personal-table-form';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Props interface for the main component
interface PersonalTableProps {
  clientId: string;
  trainers: PTTrainer[];
  packages: PTPackage[];
  sessions: PTSession[];
}

const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};


function SessionWorkoutWrapper({ session, sessionNumber, clientId, packageId, trainers }: { session: PTSession | null, sessionNumber: number, clientId: string, packageId: string, trainers: PTTrainer[] }) {
    const { firestore } = useFirebase();
    const trainerName = session ? (trainers.find(t => t.id === session.trainer_id)?.name || 'Unassigned') : 'Not set';

    const personalTableQuery = useMemoFirebase(
      () => (firestore && session ? query(collection(firestore, `pt_sessions/${session.id}/personalTable`)) : null),
      [firestore, session]
    );
    const { data: personalTableEntries, isLoading } = useCollection<PersonalTableEntry>(personalTableQuery);
    const personalTable = useMemo(() => personalTableEntries?.[0], [personalTableEntries]);
    
    return (
        <Accordion type="single" collapsible className="w-full bg-white rounded-lg border">
          <AccordionItem value={`session-${sessionNumber}`} className="border-b-0">
            <AccordionTrigger className="p-4 hover:no-underline">
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-4">
                      <span className={cn("font-semibold", session ? "text-primary" : "text-slate-500")}>Session {sessionNumber}</span>
                      {session && <Badge variant="secondary" className={cn('capitalize')}>{session.session_status}</Badge>}
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{session ? formatDateTime(session.session_datetime) : "Not yet occurred"}</p>
                        {session && <p className="text-sm text-muted-foreground text-right">with {trainerName}</p>}
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="p-4 bg-slate-100/50">
                    {isLoading ? (
                        <div className="flex justify-center items-center p-4"> <Loader2 className="animate-spin" /></div>
                    ) : (
                        <PersonalTableForm
                            session={session}
                            existingTable={personalTable}
                            clientId={clientId}
                            packageId={packageId}
                            onSave={() => { /* Real-time updates will handle re-render */ }}
                            onCancel={() => { /* Not needed in this accordion context */ }}
                        />
                    )}
                </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
                              return (
                                <SessionWorkoutWrapper
                                    key={session ? session.id : `slot-${pkg.id}-${slotIndex}`}
                                    session={session || null}
                                    sessionNumber={slotIndex + 1}
                                    clientId={clientId}
                                    packageId={pkg.id}
                                    trainers={trainers}
                                />
                              );
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
