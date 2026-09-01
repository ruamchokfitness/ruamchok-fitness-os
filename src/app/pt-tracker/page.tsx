
"use client";

import React, { useState, useEffect, useMemo, useTransition, useRef, useCallback } from 'react';
import Link from 'next/link';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, getDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';

import type { PTClient, PTTrainer, PTPackage, PTSession, PTCommission, PTCommissionPlan, PTCommissionTier } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Users, Award, Calendar as CalendarIcon, BarChart2, Settings, Trash2, Trophy, User, Package, Briefcase, Info, Copyright, Edit, ChevronsUpDown, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Firestore } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

// Helper Functions
const formatCurrency = (amount: number) => `฿${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatDateTime = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
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
        const totalRevenue = packages.reduce((total, p) => total + (p.price_paid || 0), 0);
        const totalHoursRemaining = activePackages.reduce((sum, p) => sum + (p.hours_remaining || 0), 0);
        const completedSessionsCount = sessions.filter(s => s.session_status === 'completed').length;

        return {
            totalClients: clients.length,
            activeTrainers: trainers.filter(t => t.status === 'active').length,
            sessionsThisMonth: totalHoursThisMonth,
            commissionThisMonth: totalCommission,
            totalRevenue,
            totalHoursRemaining,
            completedSessionsCount,
            activePackages: activePackages.slice(0, 5),
            recentSessions: sessions.slice(0, 5)
        }
    }, [clients, trainers, packages, sessions, commissions]);
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-sky-500 to-sky-700 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-80">Total Clients</p>
                            <p className="text-3xl font-bold mt-1">{stats.totalClients}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6"/>
                        </div>
                    </div>
                </Card>
                 <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Active Trainers</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.activeTrainers}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                           <Award className="w-6 h-6"/>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Sessions This Month</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{stats.sessionsThisMonth}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                            <CalendarIcon className="w-6 h-6"/>
                        </div>
                    </div>
                </Card>
                 <Card className="p-6 bg-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Commission This Month</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{formatCurrency(stats.commissionThisMonth)}</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                           <BarChart2 className="w-6 h-6"/>
                        </div>
                    </div>
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader><CardTitle>Active Packages</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.activePackages.length === 0 ? <p className="text-slate-500 text-sm">No active packages</p> : 
                                stats.activePackages.map(pkg => {
                                    const client = clients.find(c => c.id === pkg.client_id);
                                    const progress = pkg.hours_purchased > 0 ? ((pkg.hours_used || 0) / pkg.hours_purchased * 100) : 0;
                                    return (
                                        <div key={pkg.id} className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold">
                                                {client?.name?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-slate-800">{client?.name || 'Unknown'}</span>
                                                    <span className="text-sm text-slate-500">{pkg.hours_remaining || 0}h left</span>
                                                </div>
                                                <Progress value={progress} className="h-2" />
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Recent Sessions</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-1">
                             {stats.recentSessions.length === 0 ? <p className="text-slate-500 text-sm">No sessions recorded</p> : 
                                stats.recentSessions.map(session => {
                                    const client = clients.find(c => c.id === session.client_id);
                                    const trainer = trainers.find(t => t.id === session.trainer_id);
                                    return (
                                        <div key={session.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                                            <div>
                                                <p className="font-medium text-slate-800">{client?.name || 'Unknown'}</p>
                                                <p className="text-sm text-slate-500">with {trainer?.name || 'Unknown'}</p>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="outline" className={`badge-${session.session_status}`}>{session.session_status}</Badge>
                                                <p className="text-xs text-slate-400 mt-1">{formatDateTime(session.session_datetime)}</p>
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function ClientsTab({ clients, packages, db }: { clients: PTClient[], packages: PTPackage[], db: Firestore }) {
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
                <Input type="text" placeholder="Search clients by name or ID..." className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
                <Button onClick={() => { setSelectedClient(null); setClientModalOpen(true); }} className="btn-primary"><Plus className="mr-2"/> Add Client</Button>
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
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold">
                                                {client.name?.charAt(0)?.toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-semibold text-slate-800">{client.name}</p>
                                                <p className="text-sm text-slate-500">{client.member_id || 'No ID'}</p>
                                            </div>
                                            <Badge variant="outline">{client.status}</Badge>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-green-600">{activeHours} <span className="text-sm font-normal text-slate-500">hours left</span></p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-4 bg-slate-50 border-t">
                                    <div className="flex justify-end gap-2 mb-4">
                                        <Button size="sm" variant="outline" onClick={() => { setSelectedClient(client); setClientModalOpen(true); }}><Edit className="mr-2 h-3 w-3"/> Edit Client</Button>
                                        <Button size="sm" onClick={() => { setSelectedClient(client); setSelectedPackage(null); setPackageModalOpen(true); }}><Plus className="mr-2 h-3 w-3"/> New Package</Button>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Package</TableHead>
                                                <TableHead>Hours (Used/Total)</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {clientPackages.map(pkg => (
                                                <TableRow key={pkg.id}>
                                                    <TableCell className="font-medium">{pkg.package_name}</TableCell>
                                                    <TableCell>{pkg.hours_used || 0} / {pkg.hours_purchased}</TableCell>
                                                    <TableCell><Badge variant="outline">{pkg.status}</Badge></TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => { setSelectedClient(client); setSelectedPackage(pkg); setPackageModalOpen(true); }}>Edit</Button>
                                                    </TableCell>
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
            <ClientModal open={clientModalOpen} onOpenChange={setClientModalOpen} client={selectedClient} db={db} />
            <PackageModal open={packageModalOpen} onOpenChange={setPackageModalOpen} pkg={selectedPackage} client={selectedClient} clients={clients} db={db} />
        </div>
    )
}

function TrainersTab({ trainers, commissions, commissionPlans, db }: { trainers: PTTrainer[], commissions: PTCommission[], commissionPlans: PTCommissionPlan[], db: Firestore }) { 
    const [trainerModalOpen, setTrainerModalOpen] = useState(false);
    const [plansModalOpen, setPlansModalOpen] = useState(false);
    const [selectedTrainer, setSelectedTrainer] = useState<PTTrainer | null>(null);
    const thisMonthRef = getMonthReference();
    
    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold">Trainer Roster</h3>
                <div className="flex gap-2">
                    <Button onClick={() => setPlansModalOpen(true)} variant="outline"><Settings className="mr-2"/> Manage Plans</Button>
                    <Button onClick={() => { setSelectedTrainer(null); setTrainerModalOpen(true); }}><Plus className="mr-2"/> Add Trainer</Button>
                </div>
            </div>
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Earnings ({thisMonthRef})</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
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
            <TrainerModal open={trainerModalOpen} onOpenChange={setTrainerModalOpen} trainer={selectedTrainer} commissionPlans={commissionPlans} db={db} />
            <ManagePlansDialog open={plansModalOpen} onOpenChange={setPlansModalOpen} plans={commissionPlans} trainers={trainers} db={db} />
        </div>
    )
}

function SessionsTab({ sessions, clients, trainers, packages, commissionPlans, db }: { sessions: PTSession[], clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], commissionPlans: PTCommissionPlan[], db: Firestore }) { 
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [sessionToEdit, setSessionToEdit] = useState<PTSession | null>(null);
    const [manualCompleteOpen, setManualCompleteOpen] = useState(false);
    const [trainerFilter, setTrainerFilter] = useState('all');

    const filteredSessions = sessions.filter(s => trainerFilter === 'all' || s.trainer_id === trainerFilter);

    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Trainers" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Trainers</SelectItem>
                        {trainers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Button onClick={() => setManualCompleteOpen(true)}><Plus className="mr-2"/> Complete Session</Button>
            </div>
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
                        {filteredSessions.map(session => {
                            const client = clients.find(c => c.id === session.client_id);
                            const trainer = trainers.find(t => t.id === session.trainer_id);
                            return (
                                <TableRow key={session.id}>
                                    <TableCell>{formatDateTime(session.session_datetime)}</TableCell>
                                    <TableCell>{client?.member_id}</TableCell>
                                    <TableCell>{client?.name}</TableCell>
                                    <TableCell>{trainer?.name}</TableCell>
                                    <TableCell>{session.duration_hours}h</TableCell>
                                    <TableCell><Badge variant="outline">{session.session_status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => { setSessionToEdit(session); setEditModalOpen(true); }}>Edit</Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            <SessionEditModal open={editModalOpen} onOpenChange={setEditModalOpen} session={sessionToEdit} clients={clients} trainers={trainers} packages={packages} db={db} commissionPlans={commissionPlans} />
            <ManualSessionCompletionDialog open={manualCompleteOpen} onOpenChange={setManualCompleteOpen} clients={clients} trainers={trainers} packages={packages} commissionPlans={commissionPlans} db={db} />
        </div>
    )
}

function CommissionsTab({ commissions, trainers, sessions, clients, commissionPlans, packages }: { commissions: PTCommission[], trainers: PTTrainer[], sessions: PTSession[], clients: PTClient[], commissionPlans: PTCommissionPlan[], packages: PTPackage[] }) { 
    const [trainerFilter, setTrainerFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState(() => getMonthReference());
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    
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
                    if (plan.tiers.length === 1) {
                        rate = plan.tiers[0].rate;
                    } else {
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

    const summary = useMemo(() => {
        const totalHours = recalculatedCommissions.reduce((sum, c) => sum + c.duration_hours, 0);
        const totalAmount = recalculatedCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
        const trainer = trainers.find(t => t.id === trainerFilter);
        const plan = trainer ? commissionPlans.find(p => p.id === trainer.commission_plan) : null;
        return { totalHours, totalAmount, trainer, plan };
    }, [recalculatedCommissions, trainers, trainerFilter, commissionPlans]);

    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <div className="flex gap-2">
                    <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Trainers" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Trainers</SelectItem>
                            {trainers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-[180px]" />
                </div>
                 <Button onClick={() => setPdfModalOpen(true)}><Info className="mr-2 h-4 w-4" /> Generate PDF</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white border p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Hours Delivered</p>
                    <p className="text-3xl font-extrabold text-slate-900">{summary.totalHours}h</p>
                    {trainerFilter !== 'all' && <p className="text-xs text-muted-foreground mt-1 font-medium">Plan: {summary.plan?.name || '-'}</p>}
                </Card>
                <Card className="bg-white border p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Commission</p>
                    <p className="text-3xl font-extrabold text-green-600">{formatCurrency(summary.totalAmount)}</p>
                    {trainerFilter !== 'all' && <p className="text-xs text-muted-foreground mt-1 font-medium">{summary.trainer?.name}</p>}
                </Card>
                <Card className="bg-white border p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Report Period</p>
                    <p className="text-3xl font-extrabold text-slate-900">{monthFilter}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{trainerFilter === 'all' ? 'Combined Gym Report' : 'Individual Trainer Report'}</p>
                </Card>
            </div>

             <Card>
                <Table>
                    <TableHeader>
                         <TableRow>
                            <TableHead>Date</TableHead>
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
                            return (
                                <TableRow key={comm.id}>
                                    <TableCell>{formatDateTime(session?.session_datetime)}</TableCell>
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
             <PDFExportModal open={pdfModalOpen} onOpenChange={setPdfModalOpen} trainers={trainers} commissions={commissions} sessions={sessions} clients={clients} commissionPlans={commissionPlans} packages={packages} />
        </div>
    )
}

function ClientModal({ open, onOpenChange, client, db }: { open: boolean, onOpenChange: (open: boolean) => void, client: PTClient | null, db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            member_id: formData.get('member_id') as string,
            phone: formData.get('phone') as string,
            status: formData.get('status') as any,
        };

        startTransition(async () => {
            try {
                if (client) await updateDoc(doc(db, "pt_clients", client.id), data);
                else await addDoc(collection(db, "pt_clients"), { ...data, entity_type: 'client' });
                toast({ title: "Success", description: "Client saved successfully." });
                onOpenChange(false);
            } catch (error) {
                toast({ title: "Error", variant: "destructive" });
            }
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
                    <div>
                        <Label>Status</Label>
                        <Select name="status" defaultValue={client?.status || 'active'}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Save Client</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function PackageModal({ open, onOpenChange, pkg, client, db, clients }: { open: boolean, onOpenChange: (open: boolean) => void, pkg: PTPackage | null, client: PTClient | null, clients: PTClient[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Controlled Form State
    const [packageName, setPackageName] = useState('');
    const [hoursPurchased, setHoursPurchased] = useState(0);
    const [pricePaid, setPricePaid] = useState(0);
    const [hoursUsed, setHoursUsed] = useState(0);
    const [purchaseDate, setPurchaseDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [status, setStatus] = useState<any>('active');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [isClientListOpen, setIsClientListOpen] = useState(false);

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
                setClientSearch(clients.find(c => c.id === pkg.client_id)?.name || '');
            } else {
                setPackageName('Personal Training Package');
                setHoursPurchased(10);
                setPricePaid(6000);
                setHoursUsed(0);
                setPurchaseDate(new Date().toISOString().split('T')[0]);
                setExpiryDate(new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]);
                setStatus('active');
                setSelectedClientId(client?.id || '');
                setClientSearch(client?.name || '');
            }
        }
    }, [open, pkg, client, clients]);

    const pricePerHour = hoursPurchased > 0 ? pricePaid / hoursPurchased : 0;
    const hoursRemaining = Math.max(0, hoursPurchased - hoursUsed);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId) return;

        const data: Omit<PTPackage, 'id'> = {
            client_id: selectedClientId,
            package_name: packageName,
            hours_purchased: Number(hoursPurchased),
            price_paid: Number(pricePaid),
            price_per_hour: pricePerHour,
            purchase_date: purchaseDate,
            expiry_date: expiryDate,
            status: hoursRemaining <= 0 ? 'completed' : status,
            hours_used: Number(hoursUsed),
            hours_remaining: hoursRemaining,
        };

        startTransition(async () => {
            try {
                if (pkg) await updateDoc(doc(db, "pt_packages", pkg.id), data);
                else await addDoc(collection(db, "pt_packages"), { ...data, entity_type: 'package' });
                toast({ title: "Success", description: "Package saved successfully." });
                onOpenChange(false);
            } catch (error) {
                console.error("Error saving package:", error);
                toast({ title: "Error", variant: "destructive" });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{pkg ? 'Edit Package' : 'Add Package'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!pkg && (
                        <div className="relative">
                            <Label>Client *</Label>
                            <Input placeholder="Search client..." value={clientSearch} onChange={e => { setClientSearch(e.target.value); setSelectedClientId(''); setIsClientListOpen(true); }} onFocus={() => setIsClientListOpen(true)} onBlur={() => setTimeout(() => setIsClientListOpen(false), 200)} />
                            {isClientListOpen && (
                                <Card className="absolute z-50 w-full mt-1 max-h-40 overflow-y-auto shadow-xl">
                                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                                        <div key={c.id} className="p-2 hover:bg-slate-100 cursor-pointer" onMouseDown={() => { setSelectedClientId(c.id); setClientSearch(c.name); setIsClientListOpen(false); }}>{c.name} ({c.member_id})</div>
                                    ))}
                                </Card>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Package Name *</Label>
                            <Select value={packageName} onValueChange={setPackageName}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Personal Training Package">Personal Training Package</SelectItem>
                                    <SelectItem value="Boxing Training Package">Boxing Training Package</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Hours Purchased *</Label>
                            <Input type="number" value={hoursPurchased} onChange={e => setHoursPurchased(Number(e.target.value))} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Total Price (THB) *</Label>
                            <Input type="number" value={pricePaid} onChange={e => setPricePaid(Number(e.target.value))} />
                        </div>
                        <div className="bg-slate-50 p-2 rounded-md flex flex-col justify-center border border-slate-100">
                            <Label className="text-muted-foreground text-xs">Price per hour:</Label>
                            <span className="font-bold">{formatCurrency(pricePerHour)}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Purchase Date *</Label>
                            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Expiry Date *</Label>
                            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
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
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Save Package</Button>
                    </DialogFooter>
                </form>
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
        const data = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            status: formData.get('status') as any,
            commission_plan: formData.get('commission_plan') as string,
        };

        startTransition(async () => {
            try {
                if (trainer) await updateDoc(doc(db, "pt_trainers", trainer.id), data);
                else await addDoc(collection(db, "pt_trainers"), { ...data, entity_type: 'trainer' });
                toast({ title: "Success", description: "Trainer saved successfully." });
                onOpenChange(false);
            } catch (error) {
                toast({ title: "Error", variant: "destructive" });
            }
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
                    <div>
                        <Label>Commission Plan *</Label>
                        <Select name="commission_plan" defaultValue={trainer?.commission_plan || 'PLAN_A'}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {commissionPlans.filter(p=>p.id!=='BOXING').map(plan => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Status</Label>
                        <Select name="status" defaultValue={trainer?.status || 'active'}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Save Trainer</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function SessionEditModal({ open, onOpenChange, session, clients, trainers, packages, db, commissionPlans }: any) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    if (!session) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newDuration = parseFloat(formData.get('duration') as string);
        const diff = newDuration - session.duration_hours;
        
        startTransition(async () => {
            try {
                // Update Session
                await updateDoc(doc(db, "pt_sessions", session.id), { duration_hours: newDuration });
                
                // Update Package
                const pkg = packages.find((p:any) => p.id === session.purchase_id);
                if (pkg) {
                    const newUsed = (pkg.hours_used || 0) + diff;
                    await updateDoc(doc(db, "pt_packages", pkg.id), { 
                        hours_used: newUsed,
                        hours_remaining: pkg.hours_purchased - newUsed 
                    });
                }
                
                // Recalculate Commissions for this trainer in this month
                const monthRef = getMonthReference(new Date(session.session_datetime));
                const trainer = trainers.find((t:any) => t.id === session.trainer_id);
                if (trainer) {
                    await recalculateCommissions(db, trainer.id, trainer.commission_plan, commissionPlans, monthRef);
                }

                toast({ title: "Success", description: "Session updated and commissions recalculated." });
                onOpenChange(false);
            } catch (error) {
                toast({ title: "Error", variant: "destructive" });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Edit Session</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Duration (Hours)</Label>
                        <Input name="duration" type="number" step="0.5" defaultValue={session.duration_hours} required />
                    </div>
                    <p className="text-xs text-muted-foreground">Changing duration will update the client's package and recalculate trainer's commissions for this month.</p>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2"/>} Update Session</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function ManualSessionCompletionDialog({ open, onOpenChange, clients, trainers, packages, commissionPlans, db }: any) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);

    const filteredClients = useMemo(() => {
        if (!searchQuery) return [];
        return clients.filter((c: any) => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.member_id?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [clients, searchQuery]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const clientId = selectedClient;
        const packageId = formData.get('package') as string;
        const trainerId = formData.get('trainer') as string;
        const duration = parseFloat(formData.get('duration') as string);
        const dateStr = formData.get('date') as string;

        if (!clientId || !packageId || !trainerId || isNaN(duration)) {
             toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
             return;
        }

        startTransition(async () => {
             try {
                const sessionDateTime = dateStr ? new Date(dateStr) : new Date();
                const trainer = trainers.find((t:any) => t.id === trainerId);
                const pkg = packages.find((p:any) => p.id === packageId);

                if (!trainer || !pkg) throw new Error("Data not found");

                // 1. Create Session
                const sessionData: Omit<PTSession, 'id'> = {
                    client_id: clientId,
                    purchase_id: packageId,
                    trainer_id: trainerId,
                    session_datetime: sessionDateTime.toISOString(),
                    duration_hours: duration,
                    session_status: 'completed',
                    completed_by: 'Manual Admin Entry',
                    completion_timestamp: new Date().toISOString()
                };
                const newSessionRef = await addDoc(collection(db, 'pt_sessions'), sessionData);

                // 2. Update Package
                const newUsed = (pkg.hours_used || 0) + duration;
                await updateDoc(doc(db, "pt_packages", pkg.id), {
                    hours_used: newUsed,
                    hours_remaining: pkg.hours_purchased - newUsed,
                    status: (pkg.hours_purchased - newUsed) <= 0 ? 'completed' : 'active'
                });

                // 3. Recalculate Commissions
                const monthRef = getMonthReference(sessionDateTime);
                await recalculateCommissions(db, trainerId, trainer.commission_plan, commissionPlans, monthRef);

                toast({ title: "Success", description: "Session recorded manually." });
                onOpenChange(false);
                setSelectedClient('');
                setSearchQuery('');
            } catch (error) {
                toast({ title: "Error", variant: "destructive" });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Manual Session Entry</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Label>Client *</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search by name or member ID..." 
                                value={searchQuery}
                                className="pl-8"
                                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                                onFocus={() => setShowResults(true)}
                            />
                        </div>
                        {showResults && searchQuery && (
                            <Card className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto shadow-lg">
                                {filteredClients.length > 0 ? filteredClients.map((c: any) => (
                                    <div 
                                        key={c.id} 
                                        className="p-2 hover:bg-slate-100 cursor-pointer text-sm"
                                        onMouseDown={() => { 
                                            setSelectedClient(c.id); 
                                            setSearchQuery(c.name + (c.member_id ? ` (${c.member_id})` : ''));
                                            setShowResults(false);
                                        }}
                                    >
                                        {c.name} {c.member_id && <span className="text-muted-foreground ml-1">[{c.member_id}]</span>}
                                    </div>
                                )) : <div className="p-2 text-sm text-muted-foreground">No clients found</div>}
                            </Card>
                        )}
                    </div>
                    {selectedClient && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Package *</Label>
                                <Select name="package" required>
                                    <SelectTrigger><SelectValue placeholder="Select Package" /></SelectTrigger>
                                    <SelectContent>
                                        {packages.filter((p:any) => p.client_id === selectedClient && p.status === 'active').map((pkg:any) => (
                                            <SelectItem key={pkg.id} value={pkg.id}>{pkg.package_name} ({pkg.hours_remaining}h left)</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Trainer *</Label>
                                <Select name="trainer" required>
                                    <SelectTrigger><SelectValue placeholder="Select Trainer" /></SelectTrigger>
                                    <SelectContent>
                                        {trainers.map((t:any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Duration (Hours) *</Label><Input name="duration" type="number" step="0.5" defaultValue="1" required /></div>
                            <div><Label>Date</Label><Input name="date" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></div>
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending || !selectedClient}>{isPending && <Loader2 className="animate-spin mr-2"/>} Complete Session</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PDFExportModal({ open, onOpenChange, trainers, commissions, sessions, clients, commissionPlans, packages }: { open: boolean, onOpenChange: (open: boolean) => void, trainers: PTTrainer[], commissions: PTCommission[], sessions: PTSession[], clients: PTClient[], commissionPlans: PTCommissionPlan[], packages: PTPackage[] }) {
    const { toast } = useToast();
    const [month, setMonth] = useState(() => getMonthReference());

    const generateCommissionReportPDF = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const trainerId = formData.get('trainer') as string;
        const targetTrainer = trainers.find(t => t.id === trainerId);
        
        if (!targetTrainer) return;

        // Filter and Recalculate for the specific trainer and month to ensure consistency in PDF
        const trainerSessions = sessions.filter(s => s.trainer_id === trainerId && getMonthReference(new Date(s.session_datetime)) === month && s.session_status === 'completed');
        const sortedSessions = [...trainerSessions].sort((a,b) => a.session_datetime.localeCompare(b.session_datetime));
        
        const plan = commissionPlans.find(p => p.id === targetTrainer.commission_plan);
        const boxingPlan = commissionPlans.find(p => p.id === 'BOXING');
        
        let cumHours = 0;
        let cumBoxing = 0;
        const reportCommissions: any[] = [];

        sortedSessions.forEach(session => {
            const client = clients.find(c => c.id === session.client_id);
            const pkg = packages.find(p => p.id === session.purchase_id);
            const isBoxing = pkg?.package_name.toLowerCase().includes('boxing');
            const dur = session.duration_hours;
            
            let rate = 0;
            let type = '';
            let before = 0;
            if (isBoxing && boxingPlan) {
                rate = boxingPlan.tiers[0].rate;
                before = cumBoxing;
                cumBoxing += dur;
                type = 'Boxing Package';
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
                before = cumHours;
                cumHours += dur;
                type = plan.name;
            }
            reportCommissions.push({
                date: formatDateTime(session.session_datetime),
                client: client?.name || 'Unknown',
                pkg: pkg?.package_name || 'Unknown',
                duration: dur,
                rate: Math.round(rate),
                amount: Math.round(rate * dur),
                cumBefore: before,
                cumAfter: before + dur,
                type: type
            });
        });

        // Separate and re-order for PDF: Plan Items first, then Boxing Items
        const planItems = reportCommissions.filter(c => c.type !== 'Boxing Package');
        const boxingItems = reportCommissions.filter(c => c.type === 'Boxing Package');
        const finalData = [...planItems, ...boxingItems];

        if (finalData.length === 0) {
            toast({ title: "No data found for this month.", variant: "destructive" });
            return;
        }

        const totalCommission = finalData.reduce((sum, c) => sum + c.amount, 0);
        const totalHours = finalData.reduce((sum, c) => sum + c.duration, 0);

        let htmlContent = `
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><title>Commission Report</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .header { margin-bottom: 10px; }
                .header h1 { font-size: 24px; margin-bottom: 5px; font-weight: bold; }
                .header-sub { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; font-size: 14px; }
                .summary-boxes { display: flex; gap: 15px; margin: 20px 0; }
                .summary-box { flex: 1; border: 1px solid #ccc; padding: 15px; text-align: center; }
                .box-label { font-size: 12px; font-weight: bold; color: #666; margin-bottom: 5px; text-transform: uppercase; }
                .box-value { font-size: 20px; font-weight: bold; }
                .section-title { font-size: 16px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; text-transform: uppercase; }
                .section-header { background: #fafafa; font-weight: bold; }
            </style></head><body>
            <div class="header">
                <h1>TRAINING REPORT</h1>
                <div class="header-sub">
                    <span><strong>Trainer:</strong> ${targetTrainer.name}</span>
                    <span><strong>Plan:</strong> ${plan?.name || 'N/A'}</span>
                </div>
            </div>
            <div class="summary-boxes">
                <div class="summary-box">
                    <div class="box-label">Hours Delivered</div>
                    <div class="box-value">${totalHours}h</div>
                </div>
                <div class="summary-box">
                    <div class="box-label">Total Earned</div>
                    <div class="box-value">${formatCurrency(totalCommission)}</div>
                </div>
                <div class="summary-box">
                    <div class="box-label">Period</div>
                    <div class="box-value">${month}</div>
                </div>
            </div>
            <div class="section-title">COMMISSION SUMMARY</div>
            <table><thead><tr>
                <th>Date</th><th>Client</th><th>Package</th><th>Duration</th><th>Rate</th><th>Cumulative</th><th>Amount</th>
            </tr></thead><tbody>
            ${finalData.map(c => `
                <tr class="${c.type === 'Boxing Package' ? 'section-header' : ''}">
                    <td>${c.date}</td><td>${c.client}</td><td>${c.pkg}</td><td>${c.duration}h</td><td>${formatCurrency(c.rate)}</td><td>${c.cumBefore}h → ${c.cumAfter}h</td><td>${formatCurrency(c.amount)}</td>
                </tr>
            `).join('')}
            </tbody></table>
            </body></html>
        `;

        const printWindow = window.open('', '', 'width=1000,height=800');
        if (!printWindow) return;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Generate Trainer Report</DialogTitle></DialogHeader>
                <form onSubmit={generateCommissionReportPDF} className="space-y-4">
                    <div>
                        <Label>Select Month</Label>
                        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} required />
                    </div>
                    <div>
                        <Label>Select Trainer</Label>
                        <Select name="trainer" required>
                            <SelectTrigger><SelectValue placeholder="Select Trainer" /></SelectTrigger>
                            <SelectContent>{trainers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Generate PDF</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ManagePlansDialog({ open, onOpenChange, plans, trainers, db }: { open: boolean, onOpenChange: (open: boolean) => void, plans: PTCommissionPlan[], trainers: PTTrainer[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleUpdateRate = async (planId: string, tierIndex: number, newRate: number) => {
        const plan = plans.find(p => p.id === planId);
        if (!plan) return;
        const newTiers = [...plan.tiers];
        newTiers[tierIndex].rate = newRate;
        
        startTransition(async () => {
            try {
                await updateDoc(doc(db, "pt_commission_plans", planId), { tiers: newTiers });
                toast({ title: "Rate updated." });
            } catch (e) {
                toast({ title: "Error", variant: "destructive" });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Commission Plans</DialogTitle></DialogHeader>
                <div className="space-y-6">
                    {plans.map(plan => (
                        <div key={plan.id} className="p-4 border rounded-lg bg-slate-50">
                            <h4 className="font-bold mb-3">{plan.name}</h4>
                            <div className="space-y-2">
                                {plan.tiers.map((tier, idx) => (
                                    <div key={idx} className="flex items-center gap-4 bg-white p-2 rounded border">
                                        <span className="text-sm text-slate-500 w-32">{tier.maxHours === Infinity ? 'Remaining Hours' : `First ${tier.maxHours} Hours`}</span>
                                        <div className="flex items-center gap-2">
                                            <Label>Rate:</Label>
                                            <Input 
                                                type="number" 
                                                className="w-24" 
                                                defaultValue={tier.rate} 
                                                onBlur={(e) => handleUpdateRate(plan.id, idx, parseFloat(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

async function recalculateCommissions(db: Firestore, trainerId: string, newPlanId: PTTrainer['commission_plan'], allPlans: PTCommissionPlan[], monthRef: string) {
    const [year, month] = monthRef.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0, 23, 59, 59);

    const sessionsQuery = query(collection(db, "pt_sessions"), where("trainer_id", "==", trainerId));
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const allTrainerSessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTSession));

    const sessionsThisMonth = allTrainerSessions
        .filter(session => {
            const sessionDate = new Date(session.session_datetime);
            return session.session_status === 'completed' && sessionDate >= firstDay && sessionDate <= lastDay;
        })
        .sort((a, b) => new Date(a.session_datetime).getTime() - new Date(b.session_datetime).getTime());

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
        let rate = 0;
        let before = 0;
        let type = '';

        if (isBoxing && boxingPlan) {
            rate = boxingPlan.tiers[0].rate;
            before = cumBoxing;
            cumBoxing += dur;
            type = 'Boxing Package';
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
            before = cumHours;
            cumHours += dur;
            type = plan.name;
        }

        batch.set(doc(collection(db, "pt_commissions")), {
            trainer_id: trainerId,
            session_id: session.id,
            duration_hours: dur,
            hourly_rate_applied: Math.round(rate),
            commission_amount: Math.round(rate * dur),
            cumulative_hours_before: before,
            cumulative_hours_after: before + dur,
            commission_plan: isBoxing ? 'BOXING' : newPlanId,
            commission_type: type,
            month_reference: monthRef
        });
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
