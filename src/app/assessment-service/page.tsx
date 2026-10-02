
"use client";

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, where, doc, addDoc, updateDoc, arrayUnion, setDoc, deleteDoc } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { AssessmentServiceRecord, AssessmentSession, PTTrainer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Plus, ArrowUpDown, ClipboardCheck, User, Save, Edit, Trash2, Search, List, BarChart3, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


function AssessmentServicePageContent() {
    const { firestore } = useFirebase();
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<AssessmentServiceRecord | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [recordToEdit, setRecordToEdit] = useState<AssessmentServiceRecord | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<AssessmentServiceRecord | null>(null);
    const [isDeletePending, startDeleteTransition] = useTransition();
    const { toast } = useToast();

    const recordsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'assessmentServices'), orderBy('date', 'desc')) : null, [firestore]);
    const { data: records, isLoading: loadingRecords } = useCollection<AssessmentServiceRecord>(recordsQuery);

    const trainersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'pt_trainers') : null, [firestore]);
    const { data: trainers, isLoading: loadingTrainers } = useCollection<PTTrainer>(trainersQuery);

    const isLoading = loadingRecords || loadingTrainers;

    const filteredRecords = useMemo(() => {
        if (!records) return [];
        if (!searchQuery) return records;
        return records.filter(record => 
            record.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (record.memberId && record.memberId.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [records, searchQuery]);

    const generateExcelReport = () => {
        if (filteredRecords.length === 0) {
            toast({ title: "No data", description: "No records to export.", variant: "destructive" });
            return;
        }

        const sorted = [...filteredRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let csvContent = "\uFEFF"; 
        const headers = ["Date", "Member ID", "Full Name", "Training Program", "Status", "Total Sessions", "Remark"];
        csvContent += headers.join(",") + "\n";

        sorted.forEach(r => {
            const row = [
                `"${r.date}"`,
                `"${r.memberId || ''}"`,
                `"${r.fullName}"`,
                `"${r.trainingProgram}"`,
                `"${r.status}"`,
                r.sessions?.length || 0,
                `"${r.remark || ''}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Assessment_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleViewDetails = (record: AssessmentServiceRecord) => {
        setSelectedRecord(record);
        setDetailsModalOpen(true);
    };

    const handleEdit = (record: AssessmentServiceRecord) => {
        setRecordToEdit(record);
        setEditModalOpen(true);
    };

    const openDeleteDialog = (record: AssessmentServiceRecord) => {
        setRecordToDelete(record);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!recordToDelete || !firestore) return;
        startDeleteTransition(async () => {
            try {
                await deleteDoc(doc(firestore, 'assessmentServices', recordToDelete.id));
                toast({ title: 'Success', description: 'Record deleted.' });
                setDeleteDialogOpen(false);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to delete record.', variant: 'destructive' });
            }
        });
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
                            <h1 className="text-2xl md:text-3xl font-bold">RCF Assessment Service Record</h1>
                            <p className="text-slate-300 text-sm md:text-base">Track and manage client assessment service usage.</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8">
                 <Tabs defaultValue="records" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="records"><List className="mr-2 h-4 w-4"/>All Records</TabsTrigger>
                        <TabsTrigger value="report"><BarChart3 className="mr-2 h-4 w-4"/>Session Report</TabsTrigger>
                    </TabsList>
                    <TabsContent value="records" className="mt-4">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle>All Records</CardTitle>
                                        <CardDescription>A log of all assessment services provided to clients.</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={generateExcelReport}><Download className="mr-2 h-4 w-4"/>Export Excel</Button>
                                        <Button onClick={() => setAddModalOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add New Record</Button>
                                    </div>
                                </div>
                                <div className="relative pt-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name or member ID..."
                                        className="pl-10"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : (
                                    <RecordsTable 
                                        records={filteredRecords} 
                                        onViewDetails={handleViewDetails}
                                        onEdit={handleEdit}
                                        onDelete={openDeleteDialog}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="report" className="mt-4">
                       <SessionReportTab records={records || []} trainers={trainers || []} />
                    </TabsContent>
                </Tabs>
            </main>

            <AddRecordDialog
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
            />
            
            {recordToEdit && (
                <EditRecordDialog
                    open={editModalOpen}
                    onOpenChange={setEditModalOpen}
                    record={recordToEdit}
                />
            )}

            {selectedRecord && (
                <RecordDetailsDialog
                    open={detailsModalOpen}
                    onOpenChange={setDetailsModalOpen}
                    record={selectedRecord}
                    trainers={trainers || []}
                />
            )}

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This will permanently delete the record for {recordToDelete?.fullName}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/80" disabled={isDeletePending}>
                            {isDeletePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// #region Table Component
type SortableKeys = keyof AssessmentServiceRecord;
type SortConfig = { key: SortableKeys; direction: 'ascending' | 'descending' };

const RecordsTable = ({ records, onViewDetails, onEdit, onDelete }: { 
    records: AssessmentServiceRecord[], 
    onViewDetails: (record: AssessmentServiceRecord) => void,
    onEdit: (record: AssessmentServiceRecord) => void,
    onDelete: (record: AssessmentServiceRecord) => void
}) => {
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
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedRecords.map((record) => (
                    <TableRow key={record.id}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>{record.memberId}</TableCell>
                        <TableCell>
                            <Button variant="link" className="p-0 h-auto" onClick={() => onViewDetails(record)}>
                                {record.fullName}
                            </Button>
                        </TableCell>
                        <TableCell>{record.trainingProgram}</TableCell>
                        <TableCell><Badge variant={record.status === 'completed' ? 'default' : 'secondary'} className={cn(record.status === 'completed' && 'bg-green-600')}>{record.status}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{record.remark}</TableCell>
                        <TableCell className="text-right">
                             <Button variant="ghost" size="icon" onClick={() => onEdit(record)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete(record)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};
// #endregion

// #region Session Report Tab
function SessionReportTab({ records, trainers }: { records: AssessmentServiceRecord[], trainers: PTTrainer[] }) {
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
    const [trainerFilter, setTrainerFilter] = useState('all');
    const { toast } = useToast();

    // 1. Flatten all sessions from all records
    const allSessions = useMemo(() => {
        return records.flatMap(record =>
            (record.sessions || []).map(session => ({
                ...session,
                recordId: record.id,
                clientName: record.fullName,
                memberId: record.memberId,
                trainingProgram: record.trainingProgram,
            }))
        );
    }, [records]);

    // 2. Filter sessions based on UI controls
    const filteredSessions = useMemo(() => {
        if (!allSessions) return [];
        return allSessions.filter(session => {
            const sessionDate = new Date(session.dateTime);
            const sessionMonth = sessionDate.toISOString().slice(0, 7);

            const monthMatch = !monthFilter || sessionMonth === monthFilter;
            const trainerMatch = trainerFilter === 'all' || session.trainerName === trainerFilter;

            return monthMatch && trainerMatch;
        });
    }, [allSessions, monthFilter, trainerFilter]);

    // 3. Calculate summary stats
    const summaryStats = useMemo(() => {
        const stats = filteredSessions.reduce((acc, session) => {
            if (!acc[session.trainerName]) {
                acc[session.trainerName] = 0;
            }
            acc[session.trainerName]++;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(stats).sort(([, countA], [, countB]) => countB - countA);
    }, [filteredSessions]);

    const generateSessionsExcel = () => {
        if (filteredSessions.length === 0) {
            toast({ title: "No data", description: "No sessions match the selected filters.", variant: "destructive" });
            return;
        }

        const sorted = [...filteredSessions].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
        
        let csvContent = "\uFEFF"; 
        const headers = ["Date", "Member ID", "Client Name", "Trainer Name", "Training Program", "Session No."];
        csvContent += headers.join(",") + "\n";

        sorted.forEach(s => {
            const row = [
                `"${new Date(s.dateTime).toLocaleDateString()}"`,
                `"${s.memberId || ''}"`,
                `"${s.clientName}"`,
                `"${s.trainerName}"`,
                `"${s.trainingProgram}"`,
                s.sessionNumber
            ];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Assessment_Sessions_Report_${monthFilter || 'All'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // JSX for the new tab
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Session Report</CardTitle>
                        <CardDescription>Filter and view individual training sessions.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={generateSessionsExcel}><Download className="mr-2 h-4 w-4"/>Export Excel</Button>
                </div>
                <div className="flex gap-2 pt-4">
                    <Input 
                        type="month" 
                        value={monthFilter} 
                        onChange={e => setMonthFilter(e.target.value)}
                        className="w-auto"
                    />
                    <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select Trainer" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Trainers</SelectItem>
                            {trainers.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <h3 className="font-semibold mb-4">Summary for {monthFilter}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {summaryStats.map(([trainerName, count]) => (
                        <Card key={trainerName} className="p-4">
                             <CardTitle className="text-lg">{trainerName}</CardTitle>
                             <p className="text-2xl font-bold text-primary">{count}</p>
                             <p className="text-sm text-muted-foreground">sessions</p>
                        </Card>
                    ))}
                    {summaryStats.length === 0 && <p className="text-muted-foreground col-span-full">No sessions found for this period.</p>}
                </div>
                
                <h3 className="font-semibold mb-4">Session Details</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Member ID</TableHead>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Program</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSessions.map((session, index) => (
                            <TableRow key={`${session.recordId}-${session.sessionNumber}-${index}`}>
                                <TableCell>{new Date(session.dateTime).toLocaleDateString()}</TableCell>
                                <TableCell>{session.clientName}</TableCell>
                                <TableCell>{session.memberId}</TableCell>
                                <TableCell>{session.trainerName}</TableCell>
                                <TableCell>{session.trainingProgram}</TableCell>
                            </TableRow>
                        ))}
                         {filteredSessions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    No sessions match the selected filters.
                                </TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
// #endregion

// #region Add Record Dialog
const addRecordSchema = z.object({
    fullName: z.string().min(1, 'Full Name is required.'),
    memberId: z.string().min(1, 'Member ID is required.'),
    date: z.string().min(1, 'Date is required.'),
    trainingProgram: z.enum(["Personal Training 1 Session", "Personal Training 3 Sessions", "Free Trial 1 Session"]),
    remark: z.string().optional(),
});

const AddRecordDialog = ({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const { register, handleSubmit, control, formState: { errors }, reset } = useForm<z.infer<typeof addRecordSchema>>({ resolver: zodResolver(addRecordSchema) });
    const [memberIdMode, setMemberIdMode] = useState<'select' | 'custom'>('select');

    const handleOpenChange = (isOpen: boolean) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            reset();
            setMemberIdMode('select');
        }
    };


    const onSubmit = (data: z.infer<typeof addRecordSchema>) => {
        startTransition(async () => {
            if (!firestore) return;

            const newRecord: Omit<AssessmentServiceRecord, 'id'> = {
                ...data,
                sessions: [],
                status: 'active',
            };

            try {
                await addDoc(collection(firestore, 'assessmentServices'), newRecord);
                toast({ title: 'Success', description: 'New assessment service record created.' });
                handleOpenChange(false);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to create record.', variant: 'destructive' });
            }
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Add Assessment Service Record</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="fullName">Full Name *</Label>
                            <Input id="fullName" {...register('fullName')} />
                            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="memberId">Member ID *</Label>
                             <Controller
                                name="memberId"
                                control={control}
                                render={({ field }) => (
                                    <>
                                        {memberIdMode === 'select' ? (
                                            <Select
                                                onValueChange={(value) => {
                                                    if (value === 'custom') {
                                                        setMemberIdMode('custom');
                                                        field.onChange('');
                                                    } else {
                                                        field.onChange(value);
                                                    }
                                                }}
                                                value={field.value || ''}
                                            >
                                                <SelectTrigger id="memberId">
                                                    <SelectValue placeholder="Select an ID" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="FT00001">FT00001</SelectItem>
                                                    <SelectItem value="custom">Enter Custom ID...</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    {...field}
                                                    placeholder="Enter custom ID"
                                                    autoFocus
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        field.onChange('');
                                                        setMemberIdMode('select');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            />
                            {errors.memberId && <p className="text-xs text-destructive mt-1">{errors.memberId.message}</p>}
                        </div>
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
        </Dialog>
    );
};
// #endregion

// #region Edit Record Dialog
const editRecordSchema = z.object({
    fullName: z.string().min(1, 'Full Name is required.'),
    memberId: z.string().min(1, 'Member ID is required.'),
    date: z.string().min(1, 'Date is required.'),
    trainingProgram: z.enum(["Personal Training 1 Session", "Personal Training 3 Sessions", "Free Trial 1 Session"]),
    remark: z.string().optional(),
});

const EditRecordDialog = ({ open, onOpenChange, record }: { open: boolean, onOpenChange: (open: boolean) => void, record: AssessmentServiceRecord }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [memberIdMode, setMemberIdMode] = useState<'select' | 'custom'>('select');

    const { register, handleSubmit, control, formState: { errors }, reset } = useForm<z.infer<typeof editRecordSchema>>({ 
        resolver: zodResolver(editRecordSchema),
        defaultValues: {
            fullName: record.fullName,
            memberId: record.memberId,
            date: record.date,
            trainingProgram: record.trainingProgram,
            remark: record.remark,
        }
    });

    useEffect(() => {
        if (record) {
            reset({
                fullName: record.fullName,
                memberId: record.memberId,
                date: record.date,
                trainingProgram: record.trainingProgram,
                remark: record.remark,
            });
            if (record.memberId === 'FT00001' || !record.memberId) {
                setMemberIdMode('select');
            } else {
                setMemberIdMode('custom');
            }
        }
    }, [record, reset]);

    const handleOpenChange = (isOpen: boolean) => {
        onOpenChange(isOpen);
        if (!isOpen) {
            reset();
        }
    };

    const onSubmit = (data: z.infer<typeof editRecordSchema>) => {
        startTransition(async () => {
            if (!firestore) return;

            try {
                await updateDoc(doc(firestore, 'assessmentServices', record.id), data as any);
                toast({ title: 'Success', description: 'Record updated.' });
                onOpenChange(false);
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
            }
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Edit Assessment Service Record</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="edit-fullName">Full Name *</Label>
                            <Input id="edit-fullName" {...register('fullName')} />
                            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="edit-memberId">Member ID *</Label>
                            <Controller
                                name="memberId"
                                control={control}
                                render={({ field }) => (
                                    <>
                                        {memberIdMode === 'select' ? (
                                            <Select
                                                onValueChange={(value) => {
                                                    if (value === 'custom') {
                                                        setMemberIdMode('custom');
                                                        field.onChange('');
                                                    } else {
                                                        field.onChange(value);
                                                    }
                                                }}
                                                value={field.value || ''}
                                            >
                                                <SelectTrigger id="edit-memberId">
                                                    <SelectValue placeholder="Select an ID" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="FT00001">FT00001</SelectItem>
                                                    <SelectItem value="custom">Enter Custom ID...</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    {...field}
                                                    placeholder="Enter custom ID"
                                                    autoFocus
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        field.onChange('FT00001');
                                                        setMemberIdMode('select');
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            />
                            {errors.memberId && <p className="text-xs text-destructive mt-1">{errors.memberId.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="edit-date">Date</Label>
                            <Input id="edit-date" type="date" {...register('date')} />
                            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                        </div>
                        <div>
                            <Label htmlFor="edit-trainingProgram">Training Program</Label>
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
                        <Label htmlFor="edit-remark">Remark</Label>
                        <Textarea id="edit-remark" {...register('remark')} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
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
                                                <Label className="text-xs">Client Signature</Label>
                                                <img src={signedSession.clientSignature} alt={`Signature for session ${sessionNumber}`} className="border rounded-md bg-white mx-auto"/>
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
    clientSignature: z.string().min(1, 'Signature is required.'),
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
                trainerName: data.trainerName,
                clientSignature: data.clientSignature,
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
                         <Controller name="clientSignature" control={control} render={({ field }) => (
                            <SignaturePad label="Client Signature" onSignatureChange={field.onChange} />
                         )}/>
                        {errors.clientSignature && <p className="text-xs text-destructive">{errors.clientSignature.message}</p>}
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
