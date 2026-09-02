
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';

import type { PTClient, PTTrainer, PTPackage, PTSession, PTCommission, PTCommissionPlan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Users, Award, Calendar as CalendarIcon, BarChart2, Settings, Trash2, Trophy, Edit, Search, FileText, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Firestore } from 'firebase/firestore';

// Helper Functions
const formatCurrency = (amount: number) => `฿${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const getMonthReference = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function PTTrackerPageContent() {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("dashboard");

    const { data: clients, isLoading: l1 } = useCollection<PTClient>(useMemoFirebase(() => db ? collection(db, "pt_clients") : null, [db]));
    const { data: trainers, isLoading: l2 } = useCollection<PTTrainer>(useMemoFirebase(() => db ? collection(db, "pt_trainers") : null, [db]));
    const { data: packages, isLoading: l3 } = useCollection<PTPackage>(useMemoFirebase(() => db ? query(collection(db, "pt_packages"), orderBy('purchase_date', 'desc')) : null, [db]));
    const { data: sessions, isLoading: l4 } = useCollection<PTSession>(useMemoFirebase(() => db ? query(collection(db, "pt_sessions"), orderBy('session_datetime', 'desc')) : null, [db]));
    const { data: commissions, isLoading: l5 } = useCollection<PTCommission>(useMemoFirebase(() => db ? query(collection(db, "pt_commissions"), orderBy('commission_amount', 'desc')) : null, [db]));
    const { data: commissionPlans, isLoading: l6 } = useCollection<PTCommissionPlan>(useMemoFirebase(() => db ? query(collection(db, "pt_commission_plans"), orderBy('name')) : null, [db]));
    
    const loading = l1 || l2 || l3 || l4 || l5 || l6;

    useEffect(() => {
        if (!db || l6) return;
        const seedCommissionPlans = async () => {
            const plansCollection = collection(db, "pt_commission_plans");
            const snapshot = await getDocs(query(plansCollection));
            if (snapshot.empty) {
                const batch = writeBatch(db);
                const defaultPlans = [
                    { id: 'PLAN_A', name: 'Plan A', isDeletable: false, tiers: [{ maxHours: 70, rate: 150 }, { maxHours: Infinity, rate: 180 }] },
                    { id: 'PLAN_B', name: 'Plan B', isDeletable: false, tiers: [{ maxHours: 70, rate: 180 }, { maxHours: Infinity, rate: 200 }] },
                    { id: 'PLAN_C', name: 'Plan C', isDeletable: false, tiers: [{ maxHours: Infinity, rate: 250 }] },
                    { id: 'BOXING', name: 'Boxing Package', isDeletable: false, tiers: [{ maxHours: Infinity, rate: 220 }] }
                ];
                defaultPlans.forEach(plan => {
                    const docRef = doc(db, "pt_commission_plans", plan.id);
                    batch.set(docRef, { name: plan.name, isDeletable: plan.isDeletable, tiers: plan.tiers });
                });
                await batch.commit();
            }
        };
        seedCommissionPlans();
    }, [db, commissionPlans, l6]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

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
                         <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-sky-700 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">RCF PT Session & Commission Tracker</h1>
                            <p className="text-slate-300 text-sm md:text-base">Track personal training sessions and commissions.</p>
                        </div>
                    </div>
                </div>
            </header>
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="sticky top-0 z-30 bg-white shadow-md">
                    <div className="container mx-auto">
                        <TabsList className="bg-transparent p-1 h-auto">
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            <TabsTrigger value="clients">Clients &amp; Packages</TabsTrigger>
                            <TabsTrigger value="trainers">Trainers</TabsTrigger>
                            <TabsTrigger value="sessions">Sessions</TabsTrigger>
                            <TabsTrigger value="commissions">Commissions</TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <div className="container mx-auto py-6">
                    <TabsContent value="dashboard">
                        <DashboardTab clients={clients||[]} trainers={trainers||[]} packages={packages||[]} sessions={sessions||[]} commissions={commissions||[]} />
                    </TabsContent>
                    <TabsContent value="clients">
                        <ClientsTab clients={clients||[]} packages={packages||[]} db={db} />
                    </TabsContent>
                    <TabsContent value="trainers">
                        <TrainersTab trainers={trainers||[]} commissions={commissions||[]} commissionPlans={commissionPlans||[]} db={db} />
                    </TabsContent>
                    <TabsContent value="sessions">
                        <SessionsTab sessions={sessions||[]} clients={clients||[]} trainers={trainers||[]} packages={packages||[]} commissionPlans={commissionPlans || []} db={db} />
                    </TabsContent>
                    <TabsContent value="commissions">
                        <CommissionsTab commissions={commissions||[]} trainers={trainers||[]} sessions={sessions||[]} clients={clients || []} commissionPlans={commissionPlans||[]} packages={packages||[]} />
                    </TabsContent>
                </div>
            </Tabs>
        </>
    )
}

function DashboardTab({ clients, trainers, packages, sessions, commissions }: { clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], sessions: PTSession[], commissions: PTCommission[] }) {
    const stats = useMemo(() => {
        const activePackages = packages.filter(p => p.status === 'active');
        const thisMonthRef = getMonthReference();
        const thisMonthCommissions = commissions.filter(c => c.month_reference === thisMonthRef);
        const totalCommission = thisMonthCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
        const totalHoursThisMonth = thisMonthCommissions.reduce((sum, c) => sum + (c.duration_hours || 0), 0);
        
        return {
            totalClients: clients.length,
            activeTrainers: trainers.filter(t => t.status === 'active').length,
            sessionsThisMonth: totalHoursThisMonth,
            commissionThisMonth: totalCommission,
            activePackages: activePackages.slice(0, 5),
            recentSessions: sessions.slice(0, 5)
        }
    }, [clients, trainers, packages, sessions, commissions]);
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-sky-500 to-sky-700 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm opacity-80">Total Clients</p><p className="text-3xl font-bold mt-1">{stats.totalClients}</p></div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Users className="w-6 h-6"/></div>
                    </div>
                </Card>
                 <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-slate-500">Active Trainers</p><p className="text-3xl font-bold text-slate-800 mt-1">{stats.activeTrainers}</p></div>
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600"><Award className="w-6 h-6"/></div>
                    </div>
                </Card>
                <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-slate-500">Sessions This Month</p><p className="text-3xl font-bold text-slate-800 mt-1">{stats.sessionsThisMonth}</p></div>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600"><CalendarIcon className="w-6 h-6"/></div>
                    </div>
                </Card>
                 <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm text-slate-500">Commission This Month</p><p className="text-3xl font-bold text-slate-800 mt-1">{formatCurrency(stats.commissionThisMonth)}</p></div>
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600"><BarChart2 className="w-6 h-6"/></div>
                    </div>
                </Card>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader><CardTitle>Active Packages</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.activePackages.map(pkg => {
                                const client = clients.find(c => c.id === pkg.client_id);
                                return (
                                    <div key={pkg.id} className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">{client?.name?.charAt(0)}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1"><span className="font-medium text-slate-800">{client?.name}</span><span className="text-sm text-slate-500">{pkg.hours_remaining}h left</span></div>
                                            <Progress value={(pkg.hours_used / pkg.hours_purchased) * 100} className="h-2" />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Recent Sessions</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                             {stats.recentSessions.map(session => {
                                const client = clients.find(c => c.id === session.client_id);
                                return (
                                    <div key={session.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                        <div><p className="font-medium text-slate-800">{client?.name}</p><p className="text-xs text-slate-400">{formatDateTime(session.session_datetime)}</p></div>
                                        <Badge variant="outline">{session.session_status}</Badge>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function ClientsTab({ clients, packages, db }: { clients: PTClient[], packages: PTPackage[], db: Firestore | null }) {
    const [search, setSearch] = useState('');
    const [clientModalOpen, setClientModalOpen] = useState(false);
    const [packageModalOpen, setPackageModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<PTClient | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<PTPackage | null>(null);

    const filteredClients = useMemo(() => 
        clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.member_id?.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
    , [clients, search]);
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Input type="text" placeholder="Search clients..." className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
                <Button onClick={() => { setSelectedClient(null); setClientModalOpen(true); }}><Plus className="mr-2"/> Add Client</Button>
            </div>
            <Card>
                <Accordion type="single" collapsible className="w-full">
                    {filteredClients.map(client => {
                        const clientPackages = packages.filter(p => p.client_id === client.id).sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
                        const activeHours = clientPackages.filter(p => p.status === 'active').reduce((sum, p) => sum + (p.hours_remaining || 0), 0);
                        return (
                            <AccordionItem value={client.id} key={client.id} className="border-b last:border-b-0">
                                <AccordionTrigger className="p-4 hover:bg-slate-50">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">{client.name?.charAt(0)}</div>
                                            <div className="text-left"><p className="font-semibold text-slate-800">{client.name}</p><p className="text-sm text-slate-500">{client.member_id || 'No ID'}</p></div>
                                        </div>
                                        <div className="text-right"><p className="font-bold text-lg text-green-600">{activeHours} <span className="text-sm font-normal text-slate-500">hours left</span></p></div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 bg-slate-50 border-t">
                                    <div className="flex justify-end gap-2 mb-4">
                                        <Button size="sm" variant="outline" onClick={() => { setSelectedClient(client); setClientModalOpen(true); }}><Edit className="mr-2 h-3 w-3"/> Edit Client</Button>
                                        <Button size="sm" onClick={() => { setSelectedClient(client); setSelectedPackage(null); setPackageModalOpen(true); }}><Plus className="mr-2 h-3 w-3"/> New Package</Button>
                                    </div>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Package</TableHead><TableHead>Hours (Used/Total)</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {clientPackages.map(pkg => (
                                                <TableRow key={pkg.id}>
                                                    <TableCell className="font-medium">{pkg.package_name}</TableCell>
                                                    <TableCell>{pkg.hours_used || 0} / {pkg.hours_purchased}</TableCell>
                                                    <TableCell><Badge variant="outline">{pkg.status}</Badge></TableCell>
                                                    <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => { setSelectedClient(client); setSelectedPackage(pkg); setPackageModalOpen(true); }}>Edit</Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            </Card>
            {db && <ClientModal open={clientModalOpen} onOpenChange={setClientModalOpen} client={selectedClient} db={db} />}
            {db && <PackageModal open={packageModalOpen} onOpenChange={setPackageModalOpen} pkg={selectedPackage} client={selectedClient} clients={clients} db={db} />}
        </div>
    )
}

function TrainersTab({ trainers, commissions, commissionPlans, db }: { trainers: PTTrainer[], commissions: PTCommission[], commissionPlans: PTCommissionPlan[], db: Firestore | null }) { 
    const [trainerModalOpen, setTrainerModalOpen] = useState(false);
    const [selectedTrainer, setSelectedTrainer] = useState<PTTrainer | null>(null);
    const thisMonthRef = getMonthReference();
    
    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold">Trainer Roster</h3>
                 <Button onClick={() => { setSelectedTrainer(null); setTrainerModalOpen(true); }}><Plus className="mr-2"/> Add Trainer</Button>
            </div>
            <Card>
                <Table>
                    <TableHeader><TableRow><TableHead>Trainer</TableHead><TableHead>Plan</TableHead><TableHead>Earnings ({thisMonthRef})</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {trainers.map(trainer => {
                            const monthlyEarned = commissions.filter(c => c.trainer_id === trainer.id && c.month_reference === thisMonthRef).reduce((sum, c) => sum + c.commission_amount, 0);
                            const plan = commissionPlans.find(p => p.id === trainer.commission_plan);
                            return (
                                <TableRow key={trainer.id}>
                                     <TableCell className="font-medium">{trainer.name}</TableCell>
                                    <TableCell><Badge variant="outline">{plan?.name}</Badge></TableCell>
                                    <TableCell className="font-bold text-green-600">{formatCurrency(monthlyEarned)}</TableCell>
                                    <TableCell><Badge variant="outline">{trainer.status}</Badge></TableCell>
                                     <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedTrainer(trainer); setTrainerModalOpen(true); }}>Edit</Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            {db && <TrainerModal open={trainerModalOpen} onOpenChange={setTrainerModalOpen} trainer={selectedTrainer} commissionPlans={commissionPlans} db={db} />}
        </div>
    )
}

function SessionsTab({ sessions, clients, trainers, packages, commissionPlans, db }: { sessions: PTSession[], clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], commissionPlans: PTCommissionPlan[], db: Firestore | null }) { 
    const { toast } = useToast();
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [sessionToEdit, setSessionToEdit] = useState<PTSession | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleToggleCheck = async (session: PTSession, checked: boolean) => {
        if (!db) return;
        try {
            await updateDoc(doc(db, "pt_sessions", session.id), { is_checked: checked });
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!db || !sessionToDelete) return;
        startTransition(async () => {
            try {
                const session = sessions.find(s => s.id === sessionToDelete);
                if (session) {
                    // Update Package hours back
                    const pkg = packages.find(p => p.id === session.purchase_id);
                    if (pkg) {
                        const newUsed = Math.max(0, (pkg.hours_used || 0) - session.duration_hours);
                        await updateDoc(doc(db, "pt_packages", pkg.id), {
                            hours_used: newUsed,
                            hours_remaining: pkg.hours_purchased - newUsed,
                            status: 'active'
                        });
                    }

                    // Delete Commission
                    const commQuery = query(collection(db, "pt_commissions"), where("session_id", "==", session.id));
                    const commSnap = await getDocs(commQuery);
                    const batch = writeBatch(db);
                    commSnap.forEach(d => batch.delete(d.ref));
                    await batch.commit();

                    // Delete Session
                    await deleteDoc(doc(db, "pt_sessions", session.id));
                    
                    toast({ title: "Session deleted." });
                }
            } catch (e) {
                toast({ title: "Error deleting", variant: "destructive" });
            }
            setDeleteConfirmOpen(false);
        });
    };

    return (
         <div className="space-y-6">
             <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date/Time</TableHead>
                            <TableHead>Member ID</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.map(session => {
                            const client = clients.find(c => c.id === session.client_id);
                            const trainer = trainers.find(t => t.id === session.trainer_id);
                            return (
                                <TableRow key={session.id} className={cn(session.is_checked && "bg-green-50/50 hover:bg-green-100/50")}>
                                    <TableCell>{formatDateTime(session.session_datetime)}</TableCell>
                                    <TableCell>{client?.member_id}</TableCell>
                                    <TableCell>{client?.name}</TableCell>
                                    <TableCell>{trainer?.name}</TableCell>
                                    <TableCell>{session.duration_hours}h</TableCell>
                                    <TableCell><Badge variant="outline">{session.session_status}</Badge></TableCell>
                                    <TableCell className="text-right flex items-center justify-end gap-2">
                                        <div className="flex items-center gap-2 mr-2 border-r pr-2">
                                            <Checkbox 
                                                checked={session.is_checked} 
                                                onCheckedChange={(checked) => handleToggleCheck(session, !!checked)}
                                                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                            />
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setSessionToEdit(session); setEditModalOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSessionToDelete(session.id); setDeleteConfirmOpen(true); }}><Trash2 className="h-4 w-4"/></Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            {db && <SessionEditModal open={editModalOpen} onOpenChange={setEditModalOpen} session={sessionToEdit} clients={clients} trainers={trainers} packages={packages} db={db} commissionPlans={commissionPlans} />}
            
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                        <AlertDialogDescription>This will revert the package hours and remove associated commissions. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin h-4 w-4"/> : 'Confirm Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function CommissionsTab({ commissions, trainers, sessions, clients, commissionPlans, packages }: { commissions: PTCommission[], trainers: PTTrainer[], sessions: PTSession[], clients: PTClient[], commissionPlans: PTCommissionPlan[], packages: PTPackage[] }) { 
    const [trainerFilter, setTrainerFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState(() => getMonthReference());
    
    const recalculatedCommissions = useMemo(() => {
        const filtered = commissions.filter(c => (trainerFilter === 'all' || c.trainer_id === trainerFilter) && c.month_reference === monthFilter);
        const byTrainer: Record<string, PTCommission[]> = {};

        filtered.forEach(c => {
            if (!byTrainer[c.trainer_id]) byTrainer[c.trainer_id] = [];
            byTrainer[c.trainer_id].push(c);
        });

        const results: PTCommission[] = [];

        Object.keys(byTrainer).forEach(tId => {
            const trainer = trainers.find(t => t.id === tId);
            if (!trainer) return;
            const plan = commissionPlans.find(p => p.id === trainer.commission_plan);
            const boxingPlan = commissionPlans.find(p => p.id === 'BOXING');
            
            const trainerComms = byTrainer[tId].sort((a,b) => {
                const dateA = sessions.find(s => s.id === a.session_id)?.session_datetime || '';
                const dateB = sessions.find(s => s.id === b.session_id)?.session_datetime || '';
                return dateA.localeCompare(dateB);
            });

            let cumHours = 0;
            let cumBoxing = 0;

            trainerComms.forEach(c => {
                const session = sessions.find(s => s.id === c.session_id);
                const pkg = session ? packages.find(p => p.id === session.purchase_id) : null;
                const isBoxing = pkg?.package_name.toLowerCase().includes('boxing');
                const dur = c.duration_hours;
                
                let rate = 0;
                if (isBoxing && boxingPlan) {
                    rate = boxingPlan.tiers[0].rate;
                    c.cumulative_hours_before = cumBoxing;
                    cumBoxing += dur;
                    c.cumulative_hours_after = cumBoxing;
                    c.commission_type = 'Boxing Package';
                } else if (plan) {
                    if (plan.tiers.length === 1) rate = plan.tiers[0].rate;
                    else {
                        const t1 = plan.tiers.find(t => t.maxHours !== Infinity);
                        const t2 = plan.tiers.find(t => t.maxHours === Infinity);
                        if (t1 && t2) {
                            if (cumHours >= t1.maxHours) rate = t2.rate;
                            else if (cumHours + dur <= t1.maxHours) rate = t1.rate;
                            else {
                                const h1 = t1.maxHours - cumHours;
                                rate = ((h1 * t1.rate) + ((dur - h1) * t2.rate)) / dur;
                            }
                        }
                    }
                    c.cumulative_hours_before = cumHours;
                    cumHours += dur;
                    c.cumulative_hours_after = cumHours;
                    c.commission_type = plan.name;
                }
                c.hourly_rate_applied = Math.round(rate);
                c.commission_amount = Math.round(rate * dur);
                results.push(c);
            });
        });

        return results.sort((a, b) => {
            const isABoxing = a.commission_type === 'Boxing Package';
            const isBBoxing = b.commission_type === 'Boxing Package';
            if (isABoxing && !isBBoxing) return 1;
            if (!isABoxing && isBBoxing) return -1;
            return a.cumulative_hours_before - b.cumulative_hours_before;
        });
    }, [commissions, trainerFilter, monthFilter, trainers, commissionPlans, sessions, packages]);

    const trainerSummaries = useMemo(() => {
        const trainersToProcess = trainerFilter === 'all' ? trainers : trainers.filter(t => t.id === trainerFilter);
        return trainersToProcess.map(trainer => {
            const trainerComms = recalculatedCommissions.filter(c => c.trainer_id === trainer.id);
            const plan = commissionPlans.find(p => p.id === trainer.commission_plan);
            return {
                id: trainer.id,
                name: trainer.name,
                plan: plan?.name || '-',
                totalHours: trainerComms.reduce((sum, c) => sum + c.duration_hours, 0),
                totalCommission: trainerComms.reduce((sum, c) => sum + c.commission_amount, 0)
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [recalculatedCommissions, trainers, commissionPlans, trainerFilter]);

    const generateCommissionPDF = () => {
        if (trainerFilter === 'all') {
            // Summary for all trainers
            const totalHours = recalculatedCommissions.reduce((sum, c) => sum + c.duration_hours, 0);
            const totalAmount = recalculatedCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Gym Commission Summary - ${monthFilter}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; color: #333; line-height: 1.4; background: white; }
                        .container { max-width: 900px; margin: 0 auto; padding: 30px 20px; }
                        .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                        .header h1 { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
                        .summary-grid { grid-template-columns: 1fr 1fr 1fr; display: grid; gap: 15px; margin-bottom: 25px; }
                        .summary-card { border: 1px solid #000; padding: 12px; text-align: center; }
                        .summary-card .label { font-size: 10px; font-weight: bold; color: #666; margin-bottom: 5px; }
                        .summary-card .value { font-size: 18px; font-weight: bold; color: #000; }
                        h2 { font-size: 14px; font-weight: bold; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #000; text-transform: uppercase; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background: #f0f0f0; color: #000; padding: 8px; text-align: left; font-weight: bold; font-size: 11px; border: 1px solid #999; }
                        td { padding: 7px 8px; border: 1px solid #ccc; font-size: 11px; }
                        .amount { text-align: right; font-weight: bold; }
                        .total-row { background: #e8e8e8; font-weight: bold; border-top: 2px solid #000; }
                        .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>GYM COMMISSION SUMMARY</h1>
                            <div style="font-size: 12px;"><strong>Period:</strong> ${monthFilter}</div>
                        </div>
                        <div class="summary-grid">
                            <div class="summary-card">
                                <div class="label">TOTAL HOURS</div>
                                <div class="value">${totalHours}h</div>
                            </div>
                            <div class="summary-card">
                                <div class="label">TOTAL PAYOUT</div>
                                <div class="value">${formatCurrency(totalAmount)}</div>
                            </div>
                            <div class="summary-card">
                                <div class="label">TRAINERS</div>
                                <div class="value">${trainerSummaries.length}</div>
                            </div>
                        </div>
                        <h2>TRAINER BREAKDOWN</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Trainer Name</th>
                                    <th>Plan</th>
                                    <th>Total Hours</th>
                                    <th style="text-align: right;">Total Commission</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${trainerSummaries.map(s => `
                                    <tr>
                                        <td>${s.name}</td>
                                        <td>${s.plan}</td>
                                        <td>${s.totalHours}h</td>
                                        <td class="amount">${formatCurrency(s.totalCommission)}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td colspan="3" style="text-align: right;">TOTAL:</td>
                                    <td class="amount">${formatCurrency(totalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="footer">
                            <p>Generated on ${new Date().toLocaleString('en-GB')}</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            const printWindow = window.open('', '', 'width=1000,height=800');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 300);
            }
            return;
        }

        const trainer = trainers.find(t => t.id === trainerFilter);
        const plan = commissionPlans.find(p => p.id === trainer?.commission_plan);
        if (!trainer) return;

        const totalHours = recalculatedCommissions.reduce((sum, c) => sum + c.duration_hours, 0);
        const totalAmount = recalculatedCommissions.reduce((sum, c) => sum + c.commission_amount, 0);

        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Commission Report - ${trainer.name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; color: #333; line-height: 1.4; background: white; }
                    .container { max-width: 900px; margin: 0 auto; padding: 30px 20px; }
                    .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h1 { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
                    .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 25px; }
                    .summary-card { border: 1px solid #000; padding: 12px; text-align: center; }
                    .summary-card .label { font-size: 10px; font-weight: bold; color: #666; margin-bottom: 5px; }
                    .summary-card .value { font-size: 18px; font-weight: bold; color: #000; }
                    h2 { font-size: 14px; font-weight: bold; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #000; text-transform: uppercase; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background: #f0f0f0; color: #000; padding: 8px; text-align: left; font-weight: bold; font-size: 11px; border: 1px solid #999; }
                    td { padding: 7px 8px; border: 1px solid #ccc; font-size: 11px; }
                    .amount { text-align: right; font-weight: bold; }
                    .total-row { background: #e8e8e8; font-weight: bold; border-top: 2px solid #000; }
                    .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
                    .signature-img { max-height: 30px; width: auto; vertical-align: middle; }
                    @media print {
                        body { margin: 0; padding: 0; }
                        .container { padding: 15px; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>TRAINING REPORT</h1>
                        <div style="font-size: 12px;">
                            <strong>Trainer:</strong> ${trainer.name} | <strong>Plan:</strong> ${plan?.name || '-'}
                        </div>
                    </div>

                    <div class="summary-grid">
                         <div class="summary-card">
                            <div class="label">HOURS DELIVERED</div>
                            <div class="value">${totalHours}h</div>
                        </div>
                        <div class="summary-card">
                            <div class="label">TOTAL EARNED</div>
                            <div class="value">${formatCurrency(totalAmount)}</div>
                        </div>
                        <div class="summary-card">
                            <div class="label">REPORT PERIOD</div>
                            <div class="value">${monthFilter}</div>
                        </div>
                    </div>
                    
                    <h2>COMMISSION SUMMARY</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Member ID</th>
                                <th>Member Name</th>
                                <th>Package Name</th>
                                <th>Duration</th>
                                <th>Rate</th>
                                <th>Cumulative</th>
                                <th style="text-align: right;">Amount</th>
                                <th style="text-align: center;">Member Sign</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recalculatedCommissions.map(comm => {
                                const session = sessions.find(s => s.id === comm.session_id);
                                const client = clients.find(c => c.id === session?.client_id);
                                const pkg = session ? packages.find(p => p.id === session.purchase_id) : null;
                                const dateOnly = session?.session_datetime ? new Date(session.session_datetime).toLocaleDateString('en-GB') : '-';
                                
                                // Abbreviate package name by removing " Package"
                                const shortPackageName = pkg ? pkg.package_name.replace(' Package', '') : '-';

                                return `
                                    <tr>
                                        <td>${dateOnly}</td>
                                        <td>${client?.member_id || '-'}</td>
                                        <td>${client?.name || '-'}</td>
                                        <td>${pkg ? `${shortPackageName} (${pkg.hours_purchased}h)` : '-'}</td>
                                        <td>${comm.duration_hours}h</td>
                                        <td>${formatCurrency(comm.hourly_rate_applied)}</td>
                                        <td>${comm.cumulative_hours_before}h → ${comm.cumulative_hours_after}h</td>
                                        <td class="amount">${formatCurrency(comm.commission_amount)}</td>
                                        <td style="text-align: center;">
                                            ${session?.clientSignature ? `<img src="${session.clientSignature}" class="signature-img" />` : '-'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            <tr class="total-row">
                                <td colspan="7" style="text-align: right;">TOTAL COMMISSION:</td>
                                <td class="amount">${formatCurrency(totalAmount)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                     <div class="footer">
                        <p>Generated on ${new Date().toLocaleString('en-GB')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '', 'width=1000,height=800');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 300);
        }
    };

    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <div className="flex gap-2">
                    <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                        <SelectTrigger className="w-[200px] bg-white"><SelectValue placeholder="All Trainers" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All Trainers</SelectItem>{trainers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                     <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-[180px] bg-white" />
                </div>
                <Button onClick={generateCommissionPDF} className="bg-primary text-white hover:bg-primary/90">
                    <FileText className="mr-2 h-4 w-4"/>Generate PDF
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trainerSummaries.map(summary => (
                    <Card key={summary.id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-all">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">{summary.name.charAt(0)}</div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 truncate">{summary.name}</h4>
                                    <Badge variant="outline" className="text-[10px] h-5 py-0 bg-slate-50 border-slate-200 text-slate-500 font-normal">{summary.plan}</Badge>
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Hours</span><span className="font-bold text-slate-800">{summary.totalHours}h</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Total Earnings</span><span className="font-bold text-green-600">{formatCurrency(summary.totalCommission)}</span></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

             <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Member ID</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Cumulative</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recalculatedCommissions.map(comm => {
                            const trainer = trainers.find(t => t.id === comm.trainer_id);
                            const session = sessions.find(s => s.id === comm.session_id);
                            const client = session ? clients.find(c => c.id === session.client_id) : null;
                            return (
                                <TableRow key={comm.id}>
                                    <TableCell>{formatDateTime(session?.session_datetime || '')}</TableCell>
                                    <TableCell>{client?.member_id || '-'}</TableCell>
                                    <TableCell>{client?.name || '-'}</TableCell>
                                    <TableCell>{trainer?.name}</TableCell>
                                    <TableCell><Badge variant="outline">{comm.commission_type}</Badge></TableCell>
                                    <TableCell>{comm.duration_hours}h</TableCell>
                                    <TableCell>{formatCurrency(comm.hourly_rate_applied)}</TableCell>
                                    <TableCell>{comm.cumulative_hours_before}h → {comm.cumulative_hours_after}h</TableCell>
                                    <TableCell className="text-right font-bold text-green-600">{formatCurrency(comm.commission_amount)}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}

function ClientModal({ open, onOpenChange, client, db }: { open: boolean, onOpenChange: (open: boolean) => void, client: PTClient | null, db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = { name: formData.get('name') as string, member_id: formData.get('member_id') as string, phone: formData.get('phone') as string, status: formData.get('status') as any };
        startTransition(async () => {
            try {
                if (client) await updateDoc(doc(db, "pt_clients", client.id), data);
                else await addDoc(collection(db, "pt_clients"), { ...data });
                toast({ title: "Success" });
                onOpenChange(false);
            } catch (error) { toast({ title: "Error", variant: "destructive" }); }
        });
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{client ? 'Edit Client' : 'Add Client'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><Label>Name *</Label><Input name="name" defaultValue={client?.name} required /></div>
                    <div><Label>Member ID</Label><Input name="member_id" defaultValue={client?.member_id} /></div>
                    <div><Label>Phone</Label><Input name="phone" defaultValue={client?.phone} /></div>
                    <div><Label>Status</Label><Select name="status" defaultValue={client?.status || 'active'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Save Client</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function PackageModal({ open, onOpenChange, pkg, client, db, clients }: { open: boolean, onOpenChange: (open: boolean) => void, pkg: PTPackage | null, client: PTClient | null, clients: PTClient[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [packageName, setPackageName] = useState('');
    const [hoursPurchased, setHoursPurchased] = useState(0);
    const [pricePaid, setPricePaid] = useState(0);
    const [hoursUsed, setHoursUsed] = useState(0);
    const [purchaseDate, setPurchaseDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [status, setStatus] = useState<'active' | 'completed' | 'expired'>('active');
    const [selectedClientId, setSelectedClientId] = useState('');

    useEffect(() => {
        if (open) {
            if (pkg) {
                setPackageName(pkg.package_name || '');
                setHoursPurchased(pkg.hours_purchased || 0);
                setPricePaid(pkg.price_paid || 0);
                setHoursUsed(pkg.hours_used || 0);
                setPurchaseDate(pkg.purchase_date || '');
                setExpiryDate(pkg.expiry_date || '');
                setStatus(pkg.status || 'active');
                setSelectedClientId(pkg.client_id || '');
            } else {
                setPackageName('Personal Training Package');
                setHoursPurchased(10);
                setPricePaid(6000);
                setHoursUsed(0);
                setPurchaseDate(new Date().toISOString().split('T')[0]);
                setExpiryDate(new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]);
                setStatus('active');
                setSelectedClientId(client?.id || '');
            }
        }
    }, [open, pkg, client]);

    const hoursRemaining = Math.max(0, hoursPurchased - hoursUsed);
    const pricePerHour = hoursPurchased > 0 ? pricePaid / hoursPurchased : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId) return;
        startTransition(async () => {
            try {
                const finalData = { 
                    client_id: selectedClientId, 
                    package_name: packageName, 
                    hours_purchased: Number(hoursPurchased), 
                    price_paid: Number(pricePaid), 
                    price_per_hour: Number(pricePerHour), 
                    purchase_date: purchaseDate, 
                    expiry_date: expiryDate, 
                    status: hoursRemaining <= 0 ? 'completed' : status, 
                    hours_used: Number(hoursUsed), 
                    hours_remaining: hoursRemaining 
                };
                if (pkg) await updateDoc(doc(db, "pt_packages", pkg.id), finalData);
                else await addDoc(collection(db, "pt_packages"), finalData);
                toast({ title: "Success" });
                onOpenChange(false);
            } catch (error) { toast({ title: "Error", variant: "destructive" }); }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{pkg ? 'Edit Package' : 'Add Package'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Package Name *</Label>
                            <Select value={packageName} onValueChange={(v) => setPackageName(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Personal Training Package">Personal Training Package</SelectItem>
                                    <SelectItem value="Boxing Training Package">Boxing Training Package</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Hours Purchased *</Label>
                            <Input type="number" value={hoursPurchased} onChange={e => setHoursPurchased(Number(e.target.value))} required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Total Price (THB) *</Label>
                            <Input type="number" value={pricePaid} onChange={e => setPricePaid(Number(e.target.value))} required />
                        </div>
                        <div className="bg-slate-50 p-2 rounded-md flex flex-col justify-center border border-slate-100">
                            <Label className="text-muted-foreground text-xs">Price per hour:</Label>
                            <span className="font-bold">{formatCurrency(pricePerHour)}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Purchase Date *</Label>
                            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Expiry Date *</Label>
                            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hours Used</Label>
                            <Input type="number" step="0.5" value={hoursUsed} onChange={e => setHoursUsed(Number(e.target.value))} />
                            <p className="text-[10px] text-muted-foreground">Remaining: {hoursRemaining}h</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Save Package</Button></form>
            </DialogContent>
        </Dialog>
    )
}

function TrainerModal({ open, onOpenChange, trainer, commissionPlans, db }: { open: boolean, onOpenChange: (open: boolean) => void, trainer: PTTrainer | null, commissionPlans: PTCommissionPlan[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = { name: formData.get('name') as string, email: formData.get('email') as string, phone: formData.get('phone') as string, status: formData.get('status') as any, commission_plan: formData.get('commission_plan') as string };
        startTransition(async () => {
            try {
                if (trainer) await updateDoc(doc(db, "pt_trainers", trainer.id), data);
                else await addDoc(collection(db, "pt_trainers"), data);
                toast({ title: "Success" });
                onOpenChange(false);
            } catch (error) { toast({ title: "Error", variant: "destructive" }); }
        });
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{trainer ? 'Edit Trainer' : 'Add Trainer'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><Label>Name *</Label><Input name="name" defaultValue={trainer?.name} required /></div>
                    <div><Label>Email</Label><Input name="email" type="email" defaultValue={trainer?.email} /></div>
                    <div><Label>Phone</Label><Input name="phone" defaultValue={trainer?.phone} /></div>
                    <div><Label>Plan *</Label><Select name="commission_plan" defaultValue={trainer?.commission_plan || 'PLAN_A'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{commissionPlans.filter(p=>p.id!=='BOXING').map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Status</Label><Select name="status" defaultValue={trainer?.status || 'active'}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
                    <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Save Trainer</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function SessionEditModal({ open, onOpenChange, session, clients, trainers, packages, db, commissionPlans }: any) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    if (!session) return null;

    const client = clients.find((c:any) => c.id === session.client_id);
    const pkg = packages.find((p:any) => p.id === session.purchase_id);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newDuration = parseFloat(formData.get('duration') as string);
        const newTrainerId = formData.get('trainerId') as string;
        const newDateTime = formData.get('datetime') as string;
        const diff = newDuration - session.duration_hours;
        
        startTransition(async () => {
            try {
                // Update Session
                await updateDoc(doc(db, "pt_sessions", session.id), { 
                    duration_hours: newDuration,
                    trainer_id: newTrainerId,
                    session_datetime: new Date(newDateTime).toISOString()
                });
                
                // Update Package
                if (pkg) {
                    const newUsed = (pkg.hours_used || 0) + diff;
                    await updateDoc(doc(db, "pt_packages", pkg.id), { 
                        hours_used: newUsed,
                        hours_remaining: pkg.hours_purchased - newUsed 
                    });
                }
                
                // Recalculate Commissions
                const monthRef = getMonthReference(new Date(newDateTime));
                const trainer = trainers.find((t:any) => t.id === newTrainerId);
                if (trainer) await recalculateCommissions(db, trainer.id, trainer.commission_plan, commissionPlans, monthRef);
                if (newTrainerId !== session.trainer_id) {
                    const oldTrainer = trainers.find((t:any) => t.id === session.trainer_id);
                    if (oldTrainer) await recalculateCommissions(db, oldTrainer.id, oldTrainer.commission_plan, commissionPlans, getMonthReference(new Date(session.session_datetime)));
                }

                toast({ title: "Success" });
                onOpenChange(false);
            } catch (error) { toast({ title: "Error", variant: "destructive" }); }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Edit Session</DialogTitle>
                    <DialogDescription>For client: {client?.name}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <Label>Package</Label>
                        <div className="p-3 bg-slate-50 border rounded-md text-sm text-slate-700">
                            {pkg?.package_name} ({pkg?.hours_remaining}h left)
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Trainer *</Label>
                        <Select name="trainerId" defaultValue={session.trainer_id} required>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{trainers.map((t:any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Date & Time *</Label>
                            <Input name="datetime" type="datetime-local" defaultValue={new Date(session.session_datetime).toISOString().slice(0, 16)} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Duration (hours) *</Label>
                            <Select name="duration" defaultValue={session.duration_hours.toString()} required>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 hour</SelectItem>
                                    <SelectItem value="1.5">1.5 hours</SelectItem>
                                    <SelectItem value="2">2 hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Update Session</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

async function recalculateCommissions(db: Firestore, trainerId: string, newPlanId: string, allPlans: PTCommissionPlan[], monthRef: string) {
    const [year, month] = monthRef.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0, 23, 59, 59);

    const sessionsQuery = query(collection(db, "pt_sessions"), where("trainer_id", "==", trainerId));
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const sessionsThisMonth = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTSession))
        .filter(s => s.session_status === 'completed' && new Date(s.session_datetime) >= firstDay && new Date(s.session_datetime) <= lastDay)
        .sort((a, b) => a.session_datetime.localeCompare(b.session_datetime));

    const packagesSnapshot = await getDocs(collection(db, "pt_packages"));
    const allPackages = packagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTPackage));
    
    const commissionsQuery = query(collection(db, "pt_commissions"), where("trainer_id", "==", trainerId), where("month_reference", "==", monthRef));
    const commissionsSnapshot = await getDocs(commissionsQuery);

    const batch = writeBatch(db);
    commissionsSnapshot.forEach(doc => batch.delete(doc.ref));

    let cumHours = 0;
    let cumBoxing = 0;
    const plan = allPlans.find(p => p.id === newPlanId);
    const boxingPlan = allPlans.find(p => p.id === 'BOXING');

    for (const session of sessionsThisMonth) {
        const pkg = allPackages.find(p => p.id === session.purchase_id);
        if (!pkg) continue;
        const isBoxing = pkg.package_name.toLowerCase().includes('boxing');
        const dur = session.duration_hours;
        let rate = 0, before = 0, type = '';

        if (isBoxing && boxingPlan) {
            rate = boxingPlan.tiers[0].rate;
            before = cumBoxing; cumBoxing += dur;
            type = 'Boxing Package';
        } else if (plan) {
            if (plan.tiers.length === 1) rate = plan.tiers[0].rate;
            else {
                const t1 = plan.tiers.find(t => t.maxHours !== Infinity);
                const t2 = plan.tiers.find(t => t.maxHours === Infinity);
                if (t1 && t2) {
                    if (cumHours >= t1.maxHours) rate = t2.rate;
                    else if (cumHours + dur <= t1.maxHours) rate = t1.rate;
                    else rate = (( (t1.maxHours - cumHours) * t1.rate) + ((dur - (t1.maxHours - cumHours)) * t2.rate)) / dur;
                }
            }
            before = cumHours; cumHours += dur;
            type = plan.name;
        }

        batch.set(doc(collection(db, "pt_commissions")), { trainer_id: trainerId, session_id: session.id, duration_hours: dur, hourly_rate_applied: Math.round(rate), commission_amount: Math.round(rate * dur), cumulative_hours_before: before, cumulative_hours_after: before + dur, commission_plan: isBoxing ? 'BOXING' : newPlanId, commission_type: type, month_reference: monthRef });
    }
    await batch.commit();
}

export default function PTTrackerPage() {
    return (
        <FirebaseClientProvider>
            <PTTrackerPageContent />
        </FirebaseClientProvider>
    );
}
