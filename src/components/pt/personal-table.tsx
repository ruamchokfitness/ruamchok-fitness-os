'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { PTSession, PersonalTableEntry, PTTrainer } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, BookOpen, Edit } from 'lucide-react';
import { PersonalTableForm } from './personal-table-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '../ui/button';

interface PersonalTableProps {
  clientId: string;
  trainers: PTTrainer[];
}

const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

function SessionWorkout({ session, trainerName }: { session: PTSession, trainerName: string }) {
    const { firestore } = useFirebase();
    const [isEditing, setIsEditing] = useState(false);

    // Assuming only one personal table entry per session for simplicity
    const personalTableQuery = useMemoFirebase(() => firestore ? query(collection(firestore, `pt_sessions/${session.id}/personalTable`)) : null, [firestore, session.id]);
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

export function PersonalTable({ clientId, trainers }: PersonalTableProps) {
  const { firestore } = useFirebase();

  const sessionsQuery = useMemoFirebase(() => firestore ? query(
    collection(firestore, 'pt_sessions'),
    where('client_id', '==', clientId),
    where('session_status', '==', 'completed'),
    orderBy('session_datetime', 'desc')
  ) : null, [firestore, clientId]);
  const { data: sessions, isLoading } = useCollection<PTSession>(sessionsQuery);

  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personal Table / Workout History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No completed sessions found for this client.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="w-6 h-6"/>Personal Table / Workout History</CardTitle>
        <CardDescription>A record of all completed training sessions. Click on a session to view or add workout details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
            {sessions.map(session => {
                const trainerName = trainers.find(t => t.id === session.trainer_id)?.name || 'Unknown Trainer';
                return (
                    <AccordionItem value={session.id} key={session.id}>
                        <AccordionTrigger className="p-4 hover:bg-slate-50">
                            <div className="flex justify-between items-center w-full">
                                <span className="font-semibold text-primary">{formatDateTime(session.session_datetime)}</span>
                                <span className="text-sm text-muted-foreground">with {trainerName}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <SessionWorkout session={session} trainerName={trainerName} />
                        </AccordionContent>
                    </AccordionItem>
                )
            })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
