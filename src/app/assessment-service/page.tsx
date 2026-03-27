"use client";

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, where, doc, addDoc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { AssessmentServiceRecord, AssessmentSession, PTClient, PTTrainer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Plus, ArrowUpDown, ClipboardCheck, User, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';


function AssessmentServicePageContent() {
    const { firestore } = useFirebase();
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AssessmentServiceRecord | null>(null);

    const recordsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'assessmentServices'), orderBy('date', 'desc')) : null, [firestore]);
    const { data: records, isLoading: loadingRecords } = useCollection<AssessmentServiceRecord>(recordsQuery);

    const clientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'pt_clients') : null, [firestore]);
    const { data: clients, isLoading: loadingClients } = useCollection<PTClient>(clientsQuery);
    
    const trainersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'pt_trainers') : null, [firestore]);
    const { data: trainers, isLoading: loadingTrainers } = useCollection<PTTrainer>(trainersQuery);

    const isLoading = loadingRecords || loadingClients || loadingTrainers;

    const handleViewDetails = (record: AssessmentServiceRecord) => {
        setSelectedRecord(record);
        setDetailsModalOpen(true);
    };
    
    return (
        <>
            <header className="bg-slate-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <ClipboardCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">Assessment Service Records</h1>
                            <p className="text-slate-300 text-sm md:text-base">Track and manage client assessment service usage.</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>All Records</CardTitle>
                            <CardDescription>A log of all assessment services provided to clients.</CardDescription>
                        </div>
                        <Button onClick={() => setAddModalOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add New Record</Button>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <RecordsTable records={records || []} onViewDetails={handleViewDetails} />
                        )}
                    </CardContent>
                </Card>
            </main>

            <AddRecordDialog
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                clients={clients || []}
            />

            {selectedRecord && (
                <RecordDetailsDialog
                    open={detailsModalOpen}
                    onOpenChange={setDetailsModalOpen}
                    record={selectedRecord}
                    trainers={trainers || []}
                />
            )}
        </>
    );
}

// #region Table Component
type SortableKeys = keyof AssessmentServiceRecord;
type SortConfig = { key: SortableKeys; direction: 'ascending' | 'descending' };

const RecordsTable = ({ records, onViewDetails }: { records: AssessmentServiceRecord[], onViewDetails: (record: AssessmentServiceRecord) => void }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'descending' });

    const sortedRecords = useMemo(() => {
        let sortableItems = [...records];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [records, sortConfig]);

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
        }
        return sortConfig.direction === 'ascending' ? <ArrowUpDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />;
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date {getSortIcon('date')}</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('memberId')}>Member ID {getSortIcon('memberId')}</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => requestSort('fullName')}>Full Name {getSortIcon('fullName')}</TableHead>
                    <TableHead>Training Program</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remark</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedRecords.map((record) => (
                    <TableRow key={record.id} onClick={() => onViewDetails(record)} className="cursor-pointer">
                        <TableCell>{record.date}</TableCell>
                        <TableCell>{record.memberId}</TableCell>
                        <TableCell>{record.fullName}</TableCell>
                        <TableCell>{record.trainingProgram}</TableCell>
                        <TableCell><Badge variant={record.status === 'completed' ? 'default' : 'secondary'} className={cn(record.status === 'completed' && 'bg-green-600')}>{record.status}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{record.remark}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};
// #endregion

// #region Add Record Dialog
const addRecordSchema = z.object({
    clientId: z.string().min(1, 'Client is required.'),
    date: z.string().min(1, 'Date is required.'),
    trainingProgram: z.enum(["Personal Training 1 Session", "Personal Training 3 Sessions", "Free Trial 1 Session"]),
    remark: z.string().optional(),
});

const AddRecordDialog = ({ open, onOpenChange, clients }: { open: boolean, onOpenChange: (open: boolean) => void, clients: PTClient[] }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const { register, handleSubmit, control, formState: { errors }, reset, setValue, watch } = useForm<z.infer<typeof addRecordSchema>>({ resolver: zodResolver(addRecordSchema) });

    const [clientSearch, setClientSearch] = useState('');
    const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
    const selectedClientId = watch('clientId');
    const selectedClient = clients.find(c => c.id === selectedClientId);

    const onSubmit = (data: z.infer<typeof addRecordSchema>) => {
        startTransition(async () => {
            if (!firestore || !selectedClient) return;

            const newRecord: Omit<AssessmentServiceRecord, 'id'> = {
                ...data,
                memberId: selectedClient.member_id || '',
                fullName: selectedClient.name,
                sessions: [],
                status: 'active',
            };

            try {
                await addDoc(collection(firestore, 'assessmentServices'), newRecord);
                toast({ title: 'Success', description: 'New assessment service record created.' });
                reset();
                onOpenChange(false);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to create record.', variant: 'destructive' });
            }
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) reset(); }}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Add Assessment Service Record</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                     <div className="space-y-2">
                        <Label>Client *</Label>
                        <div className="flex items-center gap-2">
                           <Input readOnly value={selectedClient?.name || 'No client selected'} className="flex-1 bg-slate-100" />
                            <Button type="button" variant="outline" onClick={() => setClientSelectorOpen(true)}>Select Client</Button>
                        </div>
                        {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="date">Date</Label>
                            <Input id="date" type="date" {...register('date')} defaultValue={new Date().toISOString().split('T')[0]} />
                            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="trainingProgram">Training Program</Label>
                             <Controller name="trainingProgram" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select a program" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Personal Training 1 Session">Personal Training 1 Session</SelectItem>
                                        <SelectItem value="Personal Training 3 Sessions">Personal Training 3 Sessions</SelectItem>
                                        <SelectItem value="Free Trial 1 Session">Free Trial 1 Session</SelectItem>
                                    </SelectContent>
                                </Select>
                             )}/>
                            {errors.trainingProgram && <p className="text-xs text-destructive">{errors.trainingProgram.message}</p>}
                        </div>
                    </div>
                     <div>
                        <Label htmlFor="remark">Remark</Label>
                        <Textarea id="remark" {...register('remark')} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Record</Button>
                    </DialogFooter>
                </form>
            </DialogContent>

             <Dialog open={clientSelectorOpen} onOpenChange={setClientSelectorOpen} modal={true}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Select a Client</DialogTitle></DialogHeader>
                    <Input placeholder="Search by name or ID..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} autoFocus />
                    <ScrollArea className="h-72 mt-4">
                        <div className="space-y-1 p-1">
                            {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.member_id?.toLowerCase().includes(clientSearch.toLowerCase())).map(client => (
                                <Button key={client.id} type="button" variant="ghost" className="w-full justify-start text-left h-auto" onClick={() => { setValue('clientId', client.id); setClientSelectorOpen(false); }}>
                                    <div><p className="font-medium">{client.name}</p><p className="text-xs text-slate-500">{client.member_id}</p></div>
                                </Button>
                            ))}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};

// #endregion

// #region Details & Signing Dialogs
const RecordDetailsDialog = ({ open, onOpenChange, record, trainers }: { open: boolean, onOpenChange: (open: boolean) => void, record: AssessmentServiceRecord, trainers: PTTrainer[] }) => {
    const [signModalOpen, setSignModalOpen] = useState(false);
    const [sessionToSign, setSessionToSign] = useState<number | null>(null);

    const totalSessions = record.trainingProgram.includes('3') ? 3 : 1;
    const sessionSlots = Array.from({ length: totalSessions }, (_, i) => i + 1);
    
    const handleSignClick = (sessionNumber: number) => {
        setSessionToSign(sessionNumber);
        setSignModalOpen(true);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Assessment Service Details</DialogTitle>
                        <DialogDescription>{record.fullName} ({record.memberId}) - {record.trainingProgram}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {sessionSlots.map(sessionNumber => {
                            const signedSession = record.sessions?.find(s => s.sessionNumber === sessionNumber);
                            return (
                                <Card key={sessionNumber} className="overflow-hidden">
                                    <CardHeader className="p-4 bg-slate-50 flex-row justify-between items-center">
                                        <CardTitle className="text-base">Session {sessionNumber}</CardTitle>
                                        {!signedSession && record.status === 'active' && (
                                            <Button size="sm" onClick={() => handleSignClick(sessionNumber)}>Sign For Session</Button>
                                        )}
                                        {signedSession && (
                                            <Badge variant="default" className="bg-green-600">Completed</Badge>
                                        )}
                                    </CardHeader>
                                    {signedSession && (
                                        <CardContent className="p-4 grid grid-cols-2 gap-4 items-center">
                                            <div>
                                                <p className="text-sm"><strong>Date:</strong> {new Date(signedSession.dateTime).toLocaleString()}</p>
                                                <p className="text-sm"><strong>Trainer:</strong> {signedSession.trainerName}</p>
                                            </div>
                                            <div className="text-center">
                                                <Label className="text-xs">Trainer Signature</Label>
                                                <img src={signedSession.trainerSignature} alt={`Signature for session ${sessionNumber}`} className="border rounded-md bg-white mx-auto"/>
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {sessionToSign && (
                <SignSessionDialog
                    open={signModalOpen}
                    onOpenChange={setSignModalOpen}
                    record={record}
                    sessionNumber={sessionToSign}
                    trainers={trainers}
                />
            )}
        </>
    );
};

const signSessionSchema = z.object({
    trainerName: z.string().min(1, 'Trainer is required.'),
    trainerSignature: z.string().min(1, 'Signature is required.'),
});

const SignSessionDialog = ({ open, onOpenChange, record, sessionNumber, trainers }: { open: boolean, onOpenChange: (open: boolean) => void, record: AssessmentServiceRecord, sessionNumber: number, trainers: PTTrainer[] }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const { register, handleSubmit, control, formState: { errors }, reset } = useForm<z.infer<typeof signSessionSchema>>({ resolver: zodResolver(signSessionSchema) });

    const onSubmit = (data: z.infer<typeof signSessionSchema>) => {
        startTransition(async () => {
            if (!firestore) return;

            const newSession: AssessmentSession = {
                sessionNumber,
                dateTime: new Date().toISOString(),
                ...data,
            };

            const recordRef = doc(firestore, 'assessmentServices', record.id);
            const newSessionsArray = [...(record.sessions || []), newSession];
            const totalSessionsRequired = record.trainingProgram.includes('3') ? 3 : 1;
            const newStatus = newSessionsArray.length >= totalSessionsRequired ? 'completed' : 'active';
            
            try {
                await updateDoc(recordRef, {
                    sessions: newSessionsArray,
                    status: newStatus
                });
                toast({ title: 'Success', description: `Session ${sessionNumber} signed off.` });
                onOpenChange(false);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to sign session.', variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) reset(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sign for Session {sessionNumber}</DialogTitle>
                    <DialogDescription>Record usage for {record.fullName}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                     <div>
                        <Label htmlFor="trainerName">Trainer</Label>
                        <Controller name="trainerName" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select a trainer" /></SelectTrigger>
                                <SelectContent>
                                    {trainers.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}/>
                        {errors.trainerName && <p className="text-xs text-destructive">{errors.trainerName.message}</p>}
                    </div>
                    <div>
                         <Controller name="trainerSignature" control={control} render={({ field }) => (
                            <SignaturePad label="Trainer Signature" onSignatureChange={field.onChange} />
                         )}/>
                        {errors.trainerSignature && <p className="text-xs text-destructive">{errors.trainerSignature.message}</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm & Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
// #endregion

export default function AssessmentServicePage() {
    return (
        <FirebaseClientProvider>
            <AssessmentServicePageContent />
        </FirebaseClientProvider>
    );
}
