'use client';

import React, { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { PTSession, PTTrainer } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface SessionHistoryTableProps {
  packageId: string;
  trainers: PTTrainer[];
}

const formatDateTime = (dateStr: string) => {
    if (!dateStr) return { date: '-', time: '-' };
    const d = new Date(dateStr);
    return {
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    };
};

export function SessionHistoryTable({ packageId, trainers }: SessionHistoryTableProps) {
    const { firestore } = useFirebase();

    const sessionsQuery = useMemoFirebase(
        () => firestore 
            ? query(
                collection(firestore, 'pt_sessions'), 
                where('purchase_id', '==', packageId)
              ) 
            : null,
        [firestore, packageId]
    );
    const { data: unsortedSessions, isLoading } = useCollection<PTSession>(sessionsQuery);

    const sessions = useMemo(() => {
        if (!unsortedSessions) return null;
        return [...unsortedSessions].sort((a, b) => {
            const dateA = a.session_datetime ? new Date(a.session_datetime).getTime() : 0;
            const dateB = b.session_datetime ? new Date(b.session_datetime).getTime() : 0;
            return dateA - dateB;
        });
    }, [unsortedSessions]);

    if (isLoading) {
        return <div className="flex justify-center items-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    if (!sessions || sessions.length === 0) {
        return <p className="text-sm text-center text-muted-foreground p-4">No sessions recorded for this package yet.</p>;
    }

    return (
        <div className="border-t mt-4 pt-4">
            <h4 className="font-semibold text-md mb-2 px-1">Session History</h4>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">No.</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Client Signature</TableHead>
                            <TableHead>Trainer Signature</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.map((session, index) => {
                            const { date, time } = formatDateTime(session.session_datetime);
                            const trainer = trainers.find(t => t.id === session.trainer_id);
                            return (
                                <TableRow key={session.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{date}</TableCell>
                                    <TableCell>{time}</TableCell>
                                    <TableCell>{trainer?.name || 'N/A'}</TableCell>
                                    <TableCell className="font-medium">{session.duration_hours}h</TableCell>
                                    <TableCell>
                                        {session.clientSignature ? (
                                            <img src={session.clientSignature} alt="Client Signature" width={80} height={40} className="bg-gray-100 rounded-sm" />
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {session.trainerSignature ? (
                                            <img src={session.trainerSignature} alt="Trainer Signature" width={80} height={40} className="bg-gray-100 rounded-sm" />
                                        ) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={session.clientSignature ? "default" : "secondary"} className={session.clientSignature ? "bg-green-100 text-green-800" : ""}>
                                            {session.clientSignature ? "Signed" : "Completed Manually"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}