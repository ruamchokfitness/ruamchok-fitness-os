
"use client";

import React, { useState, useEffect, useMemo, useTransition, useRef } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, orderBy, where } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell, Line, ComposedChart, CartesianGrid } from 'recharts';

import type { PTClient, PTTrainer, PTPackage, PTSession, PTCommission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Users, Award, Calendar as CalendarIcon, BarChart2, Settings, Trash2, Trophy, User, Package, Briefcase, Info, Copyright, Edit, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Firestore } from 'firebase/firestore';


const COMMISSION_PLANS: { [key: string]: { name: string; tiers?: { maxHours: number; rate: number }[], rate?: number } } = {
    PLAN_A: {
        name: 'Plan A',
        tiers: [
            { maxHours: 70, rate: 150 },
            { maxHours: Infinity, rate: 180 }
        ]
    },
    PLAN_B: {
        name: 'Plan B',
        tiers: [
            { maxHours: 70, rate: 180 },
            { maxHours: Infinity, rate: 200 }
        ]
    },
    PLAN_C: {
        name: 'Plan C',
        rate: 250,
    },
    BOXING: {
        name: 'Boxing Package',
        rate: 220,
    }
};

const planColors: { [key: string]: string } = {
    PLAN_A: 'bg-primary-100 text-primary-700',
    PLAN_B: 'bg-green-100 text-green-700',
    PLAN_C: 'bg-cyan-100 text-cyan-700'
};

// Helper Functions
const formatCurrency = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatDateTime = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const getMonthReference = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

async function recalculateCommissions(db: Firestore, trainerId: string, newPlan: PTTrainer['commission_plan']) {
    const { toast } = useToast();
    const monthRef = getMonthReference();

    // 1. Get all completed sessions for the trainer for the current month
    const sessionsQuery = query(
        collection(db, "pt_sessions"),
        where("trainer_id", "==", trainerId),
        where("session_status", "==", "completed")
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const allCompletedSessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTSession));

    const currentMonthDate = new Date();
    const firstDay = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
    const lastDay = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0, 23, 59, 59);

    const sessionsThisMonth = allCompletedSessions
        .filter(s => {
            const sessionDate = new Date(s.session_datetime);
            return sessionDate >= firstDay && sessionDate <= lastDay;
        })
        .sort((a, b) => new Date(a.session_datetime).getTime() - new Date(b.session_datetime).getTime());

    // 2. Get all packages to find package names
    const packagesSnapshot = await getDocs(collection(db, "pt_packages"));
    const allPackages = packagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTPackage));

    // 3. Get and delete all existing commissions for this trainer and month
    const commissionsQuery = query(
        collection(db, "pt_commissions"),
        where("trainer_id", "==", trainerId),
        where("month_reference", "==", monthRef)
    );
    const commissionsSnapshot = await getDocs(commissionsQuery);

    const batch = writeBatch(db);
    commissionsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    // 4. Recalculate and create new commission docs
    let cumulativeHoursInMonth = 0;
    for (const session of sessionsThisMonth) {
        const pkg = allPackages.find(p => p.id === session.purchase_id);
        if (!pkg) {
            console.warn(`Package not found for session ${session.id}, skipping commission recalculation.`);
            continue;
        }

        const duration = session.duration_hours;
        const isBoxingPackage = pkg.package_name.toLowerCase().includes('boxing');
        let rate = 0;
        let commission = 0;
        let commissionType: PTCommission['commission_type'];

        if (isBoxingPackage) {
            rate = COMMISSION_PLANS.BOXING.rate!;
            commission = duration * rate;
            commissionType = 'BOXING';
        } else {
            const plan = COMMISSION_PLANS[newPlan];
            commissionType = newPlan;
            if (plan.rate) { // Fixed rate plan (Plan C)
                rate = plan.rate;
                commission = duration * rate;
            } else if (plan.tiers) { // Tiered plan (Plan A, B)
                const tier1Max = plan.tiers[0].maxHours;
                const tier1Rate = plan.tiers[0].rate;
                const tier2Rate = plan.tiers[1].rate;

                if (cumulativeHoursInMonth >= tier1Max) {
                    rate = tier2Rate;
                    commission = duration * rate;
                } else if ((cumulativeHoursInMonth + duration) <= tier1Max) {
                    rate = tier1Rate;
                    commission = duration * tier1Rate;
                } else {
                    const hoursAtTier1 = tier1Max - cumulativeHoursInMonth;
                    const hoursAtTier2 = duration - hoursAtTier1;
                    commission = (hoursAtTier1 * tier1Rate) + (hoursAtTier2 * tier2Rate);
                    rate = commission / duration; // Effective blended rate
                }
            }
        }
        
        const commissionData: Omit<PTCommission, 'id'> = {
            trainer_id: trainerId,
            session_id: session.id,
            duration_hours: duration,
            hourly_rate_applied: Math.round(rate),
            commission_amount: Math.round(commission),
            cumulative_hours_before: cumulativeHoursInMonth,
            cumulative_hours_after: cumulativeHoursInMonth + duration,
            commission_plan: newPlan,
            commission_type: commissionType,
            month_reference: monthRef
        };

        const newCommissionRef = doc(collection(db, "pt_commissions"));
        batch.set(newCommissionRef, commissionData);

        cumulativeHoursInMonth += duration;
    }

    // 5. Commit batch
    await batch.commit();
}


function PTTrackerPageContent() {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("dashboard");

    const { data: clients, isLoading: l1 } = useCollection<PTClient>(useMemoFirebase(() => db ? collection(db, "pt_clients") : null, [db]));
    const { data: trainers, isLoading: l2 } = useCollection<PTTrainer>(useMemoFirebase(() => db ? collection(db, "pt_trainers") : null, [db]));
    const { data: packages, isLoading: l3 } = useCollection<PTPackage>(useMemoFirebase(() => db ? query(collection(db, "pt_packages"), orderBy('purchase_date', 'desc')) : null, [db]));
    const { data: sessions, isLoading: l4 } = useCollection<PTSession>(useMemoFirebase(() => db ? query(collection(db, "pt_sessions"), orderBy('session_datetime', 'desc')) : null, [db]));
    const { data: commissions, isLoading: l5 } = useCollection<PTCommission>(useMemoFirebase(() => db ? query(collection(db, "pt_commissions"), orderBy('commission_amount', 'desc')) : null, [db]));
    
    const loading = l1 || l2 || l3 || l4 || l5;
    
    // Initial Data Seeding
    useEffect(() => {
        if (!db || l1) return;
        const seedData = async () => {
            const clientsCollection = collection(db, "pt_clients");
            const snapshot = await getDocs(query(clientsCollection, where("name", "!=", "")));
            if (snapshot.empty) {
                 const batch = writeBatch(db);
                 const demoClients: any[] = [];
                 demoClients.forEach(c => batch.set(doc(collection(db, "pt_clients")), c));

                 const demoTrainers: any[] = [];
                 demoTrainers.forEach(t => batch.set(doc(collection(db, "pt_trainers")), t));
            
                 if (demoClients.length > 0 || demoTrainers.length > 0) {
                    await batch.commit();
                 }
            }
        }
        seedData();
    }, [db, clients, l1]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <>
            <header className="bg-slate-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
                     <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-sky-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">RCF PT Session & Commission Tracker</h1>
                        <p className="text-slate-300 text-sm md:text-base">Track personal training sessions and commissions.</p>
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
                        <TrainersTab trainers={trainers||[]} commissions={commissions||[]} db={db} />
                    </TabsContent>
                    <TabsContent value="sessions">
                        <SessionsTab sessions={sessions||[]} clients={clients||[]} trainers={trainers||[]} packages={packages||[]} db={db} />
                    </TabsContent>
                    <TabsContent value="commissions">
                        <CommissionsTab commissions={commissions||[]} trainers={trainers||[]} sessions={sessions||[]} clients={clients || []} />
                    </TabsContent>
                </div>
            </Tabs>
        </>
    )
}

export default function PTTrackerPage() {
    return (
        <FirebaseClientProvider>
            <PTTrackerPageContent />
        </FirebaseClientProvider>
    );
}

// Dashboard Tab
function DashboardTab({ clients, trainers, packages, sessions, commissions }: { clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], sessions: PTSession[], commissions: PTCommission[] }) {
    const stats = useMemo(() => {
        const activePackages = packages.filter(p => p.status === 'active');
        const thisMonthRef = getMonthReference();
        const thisMonthCommissions = commissions.filter(c => c.month_reference === thisMonthRef);
        const totalCommission = thisMonthCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
        const totalHoursThisMonth = thisMonthCommissions.reduce((sum, c) => sum + (c.duration_hours || 0), 0);
        const totalRevenue = packages.reduce((sum, p) => sum + (p.price_paid || 0), 0);
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
                            <p className="text-xs text-slate-400 mt-1">hours delivered</p>
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
                    <CardHeader>
                        <CardTitle>Active Packages</CardTitle>
                    </CardHeader>
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
                                                <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                                                     <div className="bg-gradient-to-r from-sky-400 to-sky-600 h-full" style={{width: `${progress}%`}}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Sessions</CardTitle>
                    </CardHeader>
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
             <Card>
                <CardHeader>
                    <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500">Total Revenue</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(stats.totalRevenue)}</p>
                        <p className="text-xs text-slate-400">from package sales</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500">Hours Remaining</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalHoursRemaining}</p>
                        <p className="text-xs text-slate-400">to be delivered</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500">Completed Sessions</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{stats.completedSessionsCount}</p>
                        <p className="text-xs text-slate-400">total sessions</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function TablePlaceholder({ colSpan = 7 }: { colSpan?: number }) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan} className="text-center h-24 text-slate-500">
                No data available.
            </TableCell>
        </TableRow>
    )
}

// Clients & Packages Tab
function ClientsTab({ clients, packages, db }: { clients: PTClient[], packages: PTPackage[], db: Firestore }) {
    const [search, setSearch] = useState('');
    const [addClientModalOpen, setAddClientModalOpen] = useState(false);
    const [editClientModalOpen, setEditClientModalOpen] = useState(false);
    const [packageModalOpen, setPackageModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<PTClient | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<PTPackage | null>(null);

    const filteredClients = useMemo(() => 
        clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.member_id?.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
    , [clients, search]);
    
    const handleAddNewClient = () => {
        setAddClientModalOpen(true);
    };

    const handleEditClient = (client: PTClient) => {
        setSelectedClient(client);
        setEditClientModalOpen(true);
    };
    
    const handleAddPackage = (client: PTClient) => {
        setSelectedClient(client);
        setSelectedPackage(null);
        setPackageModalOpen(true);
    };
    
    const handleEditPackage = (pkg: PTPackage) => {
        const client = clients.find(c => c.id === pkg.client_id);
        setSelectedClient(client || null);
        setSelectedPackage(pkg);
        setPackageModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Input type="text" placeholder="Search clients by name or ID..." className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
                <Button onClick={handleAddNewClient} className="btn-primary"><Plus className="mr-2"/> Add Client</Button>
            </div>
            <Card>
                <Accordion type="single" collapsible className="w-full">
                    {filteredClients.length > 0 ? filteredClients.map(client => {
                        const clientPackages = packages.filter(p => p.client_id === client.id).sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
                        const activeHours = clientPackages.filter(p => p.status === 'active').reduce((sum, p) => sum + (p.hours_remaining || 0), 0);

                        return (
                            <AccordionItem value={client.id} key={client.id} className="border-b last:border-b-0">
                                <AccordionTrigger className="p-4 hover:bg-slate-50 [&[data-state=open]]:bg-slate-50">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-lg">
                                                {client.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800 text-base text-left">{client.name}</p>
                                                <p className="text-sm text-slate-500 text-left">{client.member_id || 'No ID'}</p>
                                            </div>
                                            <Badge variant="outline" className={`badge-${client.status}`}>{client.status}</Badge>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-green-600">{activeHours} <span className="text-sm font-normal text-slate-500">hours left</span></p>
                                            <p className="text-xs text-slate-400">{clientPackages.length} packages total</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-0 pb-4 px-4 bg-slate-50">
                                    <div className="border-t pt-4">
                                        <div className="flex justify-end items-center mb-2 gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleEditClient(client)}><Edit className="mr-2 h-3 w-3"/> Edit Client Info</Button>
                                            <Button size="sm" onClick={() => handleAddPackage(client)}><Plus className="mr-2 h-3 w-3"/> Add New Package</Button>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Package</TableHead>
                                                    <TableHead>Hours (Used/Total)</TableHead>
                                                    <TableHead>Price</TableHead>
                                                    <TableHead>Valid Until</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {clientPackages.length === 0 ? (
                                                    <TableRow><TableCell colSpan={6} className="text-center h-24 text-slate-500">No packages for this client.</TableCell></TableRow>
                                                ) : clientPackages.map(pkg => (
                                                    <TableRow key={pkg.id}>
                                                        <TableCell className="font-medium text-slate-800">{pkg.package_name}</TableCell>
                                                        <TableCell>{pkg.hours_used || 0} / {pkg.hours_purchased}</TableCell>
                                                        <TableCell>{formatCurrency(pkg.price_paid)}</TableCell>
                                                        <TableCell>{formatDate(pkg.expiry_date)}</TableCell>
                                                        <TableCell><Badge variant="outline" className={`badge-${pkg.status}`}>{pkg.status}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="sm" onClick={() => handleEditPackage(pkg)}>Edit</Button>
                                                            <DeleteButton type="package" id={pkg.id} name={pkg.package_name} db={db} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    }) : (
                        <div className="p-8 text-center text-slate-500">
                            No clients found matching your search.
                        </div>
                    )}
                </Accordion>
            </Card>
            {/* MODALS */}
            <ClientAndPackageModal open={addClientModalOpen} onOpenChange={setAddClientModalOpen} db={db} />
            <ClientModal open={editClientModalOpen} onOpenChange={setEditClientModalOpen} client={selectedClient} db={db} />
            <PackageModal open={packageModalOpen} onOpenChange={setPackageModalOpen} pkg={selectedPackage} client={selectedClient} clients={clients} db={db} />
        </div>
    )
}

function TrainersTab({ trainers, commissions, db }: { trainers: PTTrainer[], commissions: PTCommission[], db: Firestore }) { 
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTrainer, setSelectedTrainer] = useState<PTTrainer | null>(null);
    const thisMonthRef = getMonthReference();

    const handleEdit = (trainer: PTTrainer) => {
        setSelectedTrainer(trainer);
        setModalOpen(true);
    }
    const handleAddNew = () => {
        setSelectedTrainer(null);
        setModalOpen(true);
    }
    
    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold text-slate-800">Commission Plans</h3>
                <Button onClick={handleAddNew} className="btn-primary"><Plus className="mr-2"/> Add Trainer</Button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 border-2 border-primary-200">
                    <h4 className="font-semibold text-primary-700 mb-2">Plan A</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                        <p>Hours 1-70: <span className="font-semibold">{formatCurrency(COMMISSION_PLANS.PLAN_A.tiers![0].rate)}/hour</span></p>
                        <p>Hours 71+: <span className="font-semibold">{formatCurrency(COMMISSION_PLANS.PLAN_A.tiers![1].rate)}/hour</span></p>
                    </div>
                </Card>
                <Card className="p-4 border-2 border-green-200">
                    <h4 className="font-semibold text-green-700 mb-2">Plan B</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                         <p>Hours 1-70: <span className="font-semibold">{formatCurrency(COMMISSION_PLANS.PLAN_B.tiers![0].rate)}/hour</span></p>
                        <p>Hours 71+: <span className="font-semibold">{formatCurrency(COMMISSION_PLANS.PLAN_B.tiers![1].rate)}/hour</span></p>
                    </div>
                </Card>
                <Card className="p-4 border-2 border-cyan-200">
                    <h4 className="font-semibold text-cyan-700 mb-2">Plan C</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                         <p>Fixed Rate: <span className="font-semibold">{formatCurrency(COMMISSION_PLANS.PLAN_C.rate!)}/hour</span></p>
                    </div>
                </Card>
                 <Card className="p-4 border-2 border-red-200">
                    <h4 className="font-semibold text-red-700 mb-2">Boxing Package</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                         <p>Fixed Rate: <span className="font-semibold">{formatCurrency(COMMISSION_PLANS.BOXING.rate!)}/hour</span></p>
                         <p className="text-xs text-slate-500 italic">Hours still count towards monthly total.</p>
                    </div>
                </Card>
            </div>
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>This Month</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {trainers.length === 0 ? <TablePlaceholder /> : trainers.map(trainer => {
                            const trainerCommissions = commissions.filter(c => c.trainer_id === trainer.id && c.month_reference === thisMonthRef);
                            const monthlyHours = trainerCommissions.reduce((sum, c) => sum + (c.duration_hours || 0), 0);
                            const monthlyEarnings = trainerCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
                            return (
                                <TableRow key={trainer.id}>
                                     <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                                                {trainer.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <span className="font-medium text-slate-800">{trainer.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p>{trainer.email}</p>
                                        <p className="text-sm text-slate-500">{trainer.phone}</p>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={planColors[trainer.commission_plan] || 'bg-slate-100 text-slate-700'}>{COMMISSION_PLANS[trainer.commission_plan]?.name || 'Not Set'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold text-slate-800">{monthlyHours} hours</p>
                                        <p className="text-sm text-green-600">{formatCurrency(monthlyEarnings)}</p>
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className={`badge-${trainer.status}`}>{trainer.status}</Badge></TableCell>
                                     <TableCell className="text-right">
                                        <button onClick={() => handleEdit(trainer)} className="text-primary-600 hover:text-primary-800 mr-3">Edit</button>
                                        <DeleteButton type="trainer" id={trainer.id} name={trainer.name} db={db} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            <TrainerModal open={modalOpen} onOpenChange={setModalOpen} trainer={selectedTrainer} db={db} />
        </div>
    )
}

function SessionsTab({ sessions, clients, trainers, packages, db }: { sessions: PTSession[], clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], db: Firestore }) { 
    const [modalOpen, setModalOpen] = useState(false);
    const [trainerFilter, setTrainerFilter] = useState('all');

    const filteredSessions = useMemo(() => {
        return sessions.filter(s => trainerFilter === 'all' || s.trainer_id === trainerFilter);
    }, [sessions, trainerFilter]);

    async function handleCompleteSession(sessionId: string) {
        const session = sessions.find(s => s.id === sessionId);
        if (!session || session.session_status !== 'scheduled') return;
        // Logic to complete session and create commission
        // This is complex and involves updating multiple collections.
        // For now, just update the status.
        await updateDoc(doc(db, "pt_sessions", sessionId), { session_status: 'completed' });
    }
    async function handleCancelSession(sessionId: string) {
        await updateDoc(doc(db, "pt_sessions", sessionId), { session_status: 'cancelled' });
    }

    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Trainers" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Trainers</SelectItem>
                        {trainers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Button onClick={() => setModalOpen(true)} className="btn-primary"><Plus className="mr-2"/> Complete Session</Button>
            </div>
             <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date/Time</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Trainer</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {filteredSessions.length === 0 ? <TablePlaceholder /> : filteredSessions.map(session => {
                            const client = clients.find(c => c.id === session.client_id);
                            const trainer = trainers.find(t => t.id === session.trainer_id);
                            return (
                                <TableRow key={session.id}>
                                    <TableCell className="font-medium">{formatDateTime(session.session_datetime)}</TableCell>
                                    <TableCell>{client?.name || 'Unknown'}</TableCell>
                                    <TableCell>{trainer?.name || 'Unknown'}</TableCell>
                                    <TableCell>{session.duration_hours} hr</TableCell>
                                    <TableCell><Badge variant="outline" className={`badge-${session.session_status}`}>{session.session_status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        {session.session_status === 'scheduled' && (
                                            <>
                                                <button onClick={() => handleCompleteSession(session.id)} className="text-green-600 hover:text-green-800 mr-2" title="Mark Complete">✓</button>
                                                <button onClick={() => handleCancelSession(session.id)} className="text-orange-600 hover:text-orange-800 mr-2" title="Cancel">✕</button>
                                            </>
                                        )}
                                        <DeleteButton type="session" id={session.id} name={`Session for ${client?.name}`} db={db} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            <SessionModal open={modalOpen} onOpenChange={setModalOpen} clients={clients} trainers={trainers} packages={packages} db={db} />
        </div>
    )
}

function CommissionsTab({ commissions, trainers, sessions, clients }: { commissions: PTCommission[], trainers: PTTrainer[], sessions: PTSession[], clients: PTClient[] }) { 
    const [trainerFilter, setTrainerFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState(() => getMonthReference());
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    
    const months = useMemo(() => [...new Set(commissions.map(c => c.month_reference))].sort().reverse(), [commissions]);

    const filteredCommissions = useMemo(() => {
        return commissions.filter(c => 
            (trainerFilter === 'all' || c.trainer_id === trainerFilter) && 
            (monthFilter === 'all' || c.month_reference === monthFilter)
        );
    }, [commissions, trainerFilter, monthFilter]);
    
    const filteredTrainersForCards = useMemo(() => {
        const activeTrainers = trainers.filter(t => t.status === 'active');
        if (trainerFilter === 'all') {
            return activeTrainers;
        }
        return activeTrainers.filter(t => t.id === trainerFilter);
    }, [trainers, trainerFilter]);


    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <div className="flex gap-2">
                    <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Trainers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Trainers</SelectItem>
                            {trainers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Months" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Months</SelectItem>
                            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <Button onClick={() => setPdfModalOpen(true)}>
                    <Info className="mr-2 h-4 w-4" />
                    Generate PDF
                </Button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTrainersForCards.map(trainer => {
                    const monthCommissions = commissions.filter(c => c.trainer_id === trainer.id && (monthFilter === 'all' ? true : c.month_reference === monthFilter));
                    const totalHours = monthCommissions.reduce((sum, c) => sum + (c.duration_hours || 0), 0);
                    const totalEarnings = monthCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
                    const plan = COMMISSION_PLANS[trainer.commission_plan];
                     
                    return (
                        <Card key={trainer.id} className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-lg">
                                    {trainer.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800">{trainer.name}</h4>
                                    <Badge variant="outline" className={planColors[trainer.commission_plan] || 'bg-slate-100 text-slate-700'}>{plan?.name || 'No Plan'}</Badge>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Hours ({monthFilter === 'all' ? 'All Time' : monthFilter})</span>
                                    <span className="font-semibold text-slate-800">{totalHours}h</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-slate-100 pt-2 mt-2">
                                    <span className="text-slate-500">Total Earnings</span>
                                    <span className="font-bold text-green-600">{formatCurrency(totalEarnings)}</span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
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
                        {filteredCommissions.length === 0 ? <TablePlaceholder/> : filteredCommissions.map(comm => {
                            const trainer = trainers.find(t => t.id === comm.trainer_id);
                            const session = sessions.find(s => s.id === comm.session_id);
                            const planName = comm.commission_type === 'BOXING' ? 'Boxing' : COMMISSION_PLANS[comm.commission_plan]?.name;
                            return (
                                <TableRow key={comm.id}>
                                    <TableCell>{formatDateTime(session?.session_datetime)}</TableCell>
                                    <TableCell>{trainer?.name || 'Unknown'}</TableCell>
                                    <TableCell><Badge variant="outline" className={comm.commission_type === 'BOXING' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}>{planName}</Badge></TableCell>
                                    <TableCell>{comm.duration_hours}h</TableCell>
                                    <TableCell>{formatCurrency(comm.hourly_rate_applied)}/hr</TableCell>
                                    <TableCell>{comm.cumulative_hours_before}h → {comm.cumulative_hours_after}h</TableCell>
                                    <TableCell className="text-right font-semibold text-green-600">{formatCurrency(comm.commission_amount)}</TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
             <PDFExportModal
                open={pdfModalOpen}
                onOpenChange={setPdfModalOpen}
                trainers={trainers}
                commissions={commissions}
                sessions={sessions}
                clients={clients}
            />
        </div>
    )
}

function ClientAndPackageModal({ open, onOpenChange, db }: { open: boolean, onOpenChange: (open: boolean) => void, db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [pricePerHour, setPricePerHour] = useState(0);

    const calculatePricePerHour = (e: React.ChangeEvent<HTMLInputElement>) => {
        const form = e.target.form;
        if (!form) return;
        const hours = parseFloat((form.elements.namedItem('hours_purchased') as HTMLInputElement)?.value) || 0;
        const price = parseFloat((form.elements.namedItem('price_paid') as HTMLInputElement)?.value) || 0;
        setPricePerHour(hours > 0 ? price / hours : 0);
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        
        const clientData = {
            name: formData.get('name') as string,
            member_id: formData.get('member_id') as string,
            phone: formData.get('phone') as string,
            status: 'active' as 'active' | 'inactive',
        };

        const hours = parseFloat(formData.get('hours_purchased') as string);
        const price = parseFloat(formData.get('price_paid') as string);
        const packageName = formData.get('package_name') as string;

        if (!clientData.name) {
            toast({ title: "Client name is required", variant: "destructive" });
            return;
        }

        if (!packageName || isNaN(hours) || hours <= 0) {
            toast({ title: "Invalid Package Information", description: "Please provide a valid package name and hours purchased.", variant: "destructive" });
            return;
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(db);
                const newClientRef = doc(collection(db, "pt_clients"));
                
                batch.set(newClientRef, { ...clientData, entity_type: 'client' });

                const packageData = {
                    package_name: packageName,
                    hours_purchased: hours,
                    price_paid: price || 0,
                    price_per_hour: (hours > 0 && price > 0) ? price / hours : 0,
                    purchase_date: (formData.get('purchase_date') as string) || new Date().toISOString().split('T')[0],
                    expiry_date: (formData.get('expiry_date') as string) || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
                    status: 'active',
                    hours_used: 0,
                    hours_remaining: hours,
                    client_id: newClientRef.id, 
                    entity_type: 'package',
                };
                const newPackageRef = doc(collection(db, "pt_packages"));
                batch.set(newPackageRef, packageData);
                const successMessage = "Client and initial package created successfully.";

                await batch.commit();
                toast({ title: "Success", description: successMessage });
                onOpenChange(false);
            } catch (error) {
                console.error("Error creating client/package:", error);
                toast({ title: "Error", description: "Could not save client and package.", variant: "destructive" });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add New Client & Initial Package</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Client Details</h3>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="client-name">Full Name *</Label>
                            <Input id="client-name" name="name" required />
                        </div>
                        <div>
                            <Label htmlFor="client-member-id">Member ID</Label>
                            <Input id="client-member-id" name="member_id" />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="client-phone">Phone</Label>
                            <Input id="client-phone" name="phone" type="tel" />
                        </div>
                    </div>
                    <div className="space-y-4 border-t pt-4 mt-4">
                        <h3 className="text-lg font-semibold text-slate-800">Initial Package</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="package-name">Package Name *</Label>
                                <Select name="package_name" required>
                                    <SelectTrigger id="package-name"><SelectValue placeholder="Select a package type"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Personal Training Package">Personal Training Package</SelectItem>
                                        <SelectItem value="Boxing Training Package">Boxing Training Package</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="package-hours">Hours Purchased *</Label>
                                <Input id="package-hours" name="hours_purchased" type="number" min="0" defaultValue={0} onChange={calculatePricePerHour} required/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="package-price">Total Price (THB)</Label>
                                <Input id="package-price" name="price_paid" type="number" min="0" defaultValue={0} onChange={calculatePricePerHour}/>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg self-end">
                                <span className="text-sm text-slate-600">Price per hour: </span>
                                <span className="font-semibold text-slate-800">{formatCurrency(pricePerHour)}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="package-purchase-date">Purchase Date</Label>
                                <Input id="package-purchase-date" name="purchase_date" type="date" defaultValue={new Date().toISOString().split('T')[0]}/>
                            </div>
                            <div>
                                <Label htmlFor="package-expiry-date">Expiry Date</Label>
                                <Input id="package-expiry-date" name="expiry_date" type="date" defaultValue={new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]}/>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending} className="btn-primary">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Create Client & Package
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}


function ClientModal({ open, onOpenChange, client, db }: { open: boolean, onOpenChange: (open: boolean) => void, client: PTClient | null, db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!client) return;

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            member_id: formData.get('member_id') as string,
            phone: formData.get('phone') as string,
            status: formData.get('status') as 'active' | 'inactive',
        };

        startTransition(async () => {
            try {
                await updateDoc(doc(db, "pt_clients", client.id), data);
                toast({ title: "Client Updated" });
                onOpenChange(false);
            } catch (error) {
                toast({ title: "Error", description: "Could not save client.", variant: "destructive" });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Client</DialogTitle>
                </DialogHeader>
                {client && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="client-name">Full Name *</Label>
                                <Input id="client-name" name="name" defaultValue={client.name || ''} required />
                            </div>
                             <div>
                                <Label htmlFor="client-member-id">Member ID</Label>
                                <Input id="client-member-id" name="member_id" defaultValue={client.member_id || ''} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="client-phone">Phone</Label>
                                <Input id="client-phone" name="phone" type="tel" defaultValue={client.phone || ''} />
                            </div>
                            <div>
                                <Label htmlFor="client-status">Status</Label>
                                <Select name="status" defaultValue={client.status || 'active'}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isPending} className="btn-primary">
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Update Client
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}

function TrainerModal({ open, onOpenChange, trainer, db }: { open: boolean, onOpenChange: (open: boolean) => void, trainer: PTTrainer | null, db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            status: formData.get('status') as 'active' | 'inactive',
            commission_plan: formData.get('commission_plan') as 'PLAN_A' | 'PLAN_B' | 'PLAN_C'
        };

        startTransition(async () => {
            try {
                if (trainer) {
                    const planChanged = trainer.commission_plan !== data.commission_plan;
                    await updateDoc(doc(db, "pt_trainers", trainer.id), data);
                    toast({ title: "Trainer Updated" });

                    if (planChanged) {
                        toast({ title: "Commission plan changed", description: "Recalculating current month's commissions..." });
                        try {
                            await recalculateCommissions(db, trainer.id, data.commission_plan);
                            toast({ title: "Commissions Recalculated", description: `Commissions for the current month have been updated based on the new plan.` });
                        } catch (recalcError) {
                             console.error("Error recalculating commissions:", recalcError);
                             toast({ title: "Recalculation Error", description: "Could not update commissions for the new plan.", variant: "destructive" });
                        }
                    }
                } else {
                    await addDoc(collection(db, "pt_trainers"), { ...data, entity_type: 'trainer' });
                    toast({ title: "Trainer Added" });
                }
                onOpenChange(false);
            } catch (error) {
                console.error("Error saving trainer:", error);
                toast({ title: "Error", description: "Could not save trainer.", variant: "destructive" });
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{trainer ? 'Edit Trainer' : 'Add New Trainer'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                        <Label htmlFor="trainer-name">Full Name *</Label>
                        <Input id="trainer-name" name="name" defaultValue={trainer?.name || ''} required />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="trainer-email">Email</Label>
                            <Input id="trainer-email" name="email" type="email" defaultValue={trainer?.email || ''} />
                        </div>
                        <div>
                            <Label htmlFor="trainer-phone">Phone</Label>
                            <Input id="trainer-phone" name="phone" type="tel" defaultValue={trainer?.phone || ''} />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                            <Label htmlFor="trainer-plan">Commission Plan</Label>
                            <Select name="commission_plan" defaultValue={trainer?.commission_plan || 'PLAN_A'}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PLAN_A">Plan A</SelectItem>
                                    <SelectItem value="PLAN_B">Plan B</SelectItem>
                                    <SelectItem value="PLAN_C">Plan C</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="trainer-status">Status</Label>
                            <Select name="status" defaultValue={trainer?.status || 'active'}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending} className="btn-primary">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {trainer ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function PackageModal({ open, onOpenChange, pkg, client, db, clients }: { open: boolean, onOpenChange: (open: boolean) => void, pkg: PTPackage | null, client: PTClient | null, clients: PTClient[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [pricePerHour, setPricePerHour] = useState(0);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
    const activeClients = useMemo(() => clients.filter(c => c.status === 'active'), [clients]);

    const calculatePricePerHour = (e: React.ChangeEvent<HTMLInputElement>) => {
        const form = e.target.form;
        if (!form) return;
        const hours = parseFloat((form.elements.namedItem('hours_purchased') as HTMLInputElement).value) || 0;
        const price = parseFloat((form.elements.namedItem('price_paid') as HTMLInputElement).value) || 0;
        setPricePerHour(hours > 0 ? price / hours : 0);
    }

     useEffect(() => {
        if(open) {
            if(pkg) {
                setPricePerHour(pkg.price_per_hour || 0);
                setSelectedClientId(pkg.client_id);
            } else if (client) {
                setSelectedClientId(client.id);
                setPricePerHour(0);
            } else {
                setSelectedClientId('');
                setPricePerHour(0);
            }
        }
    }, [pkg, client, open]);
    

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const hours = parseFloat(formData.get('hours_purchased') as string);
        const price = parseFloat(formData.get('price_paid') as string);
        const clientIdFromForm = selectedClientId;
        
        if (!clientIdFromForm) {
             toast({title: "No client selected.", variant: "destructive"});
            return;
        }
        
        const data: Omit<PTPackage, 'id'> = {
            client_id: clientIdFromForm,
            package_name: formData.get('package_name') as string,
            hours_purchased: hours,
            price_paid: price,
            price_per_hour: hours > 0 ? price / hours : 0,
            purchase_date: formData.get('purchase_date') as string,
            expiry_date: formData.get('expiry_date') as string,
            status: pkg ? (formData.get('status') as PTPackage['status']) : 'active',
            hours_used: pkg?.hours_used || 0,
            hours_remaining: pkg ? hours - (pkg.hours_used || 0) : hours
        };

        startTransition(async () => {
            try {
                if (pkg) {
                    await updateDoc(doc(db, "pt_packages", pkg.id), data);
                    toast({ title: "Package Updated" });
                } else {
                     await addDoc(collection(db, "pt_packages"), { ...data, entity_type: 'package' });
                    toast({ title: "Package Added" });
                }
                onOpenChange(false);
            } catch (error) {
                toast({ title: "Error", description: "Could not save package.", variant: "destructive" });
            }
        });
    }

    const currentClient = clients.find(c => c.id === selectedClientId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{pkg ? 'Edit Package' : 'Add New Package'}</DialogTitle>
                    <DialogDescription>
                        For client: {currentClient?.name || "Please select a client"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                     {!pkg && (
                        <div className="space-y-2">
                            <Label>Client</Label>
                            <div className="flex items-center gap-2">
                               <Input
                                    readOnly
                                    value={currentClient?.name || 'No client selected'}
                                    className="flex-1 bg-slate-100"
                                />
                                <Button type="button" variant="outline" onClick={() => setClientSelectorOpen(true)}>
                                    Select Client
                                </Button>
                            </div>
                        </div>
                    )}
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="package-name">Package Name *</Label>
                            <Select name="package_name" defaultValue={pkg?.package_name} required>
                                <SelectTrigger id="package-name"><SelectValue placeholder="Select a package type"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Personal Training Package">Personal Training Package</SelectItem>
                                    <SelectItem value="Boxing Training Package">Boxing Training Package</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div>
                            <Label htmlFor="package-hours">Hours Purchased *</Label>
                            <Input id="package-hours" name="hours_purchased" type="number" min="1" defaultValue={pkg?.hours_purchased} required onChange={calculatePricePerHour}/>
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="package-price">Total Price (THB) *</Label>
                            <Input id="package-price" name="price_paid" type="number" min="0" defaultValue={pkg?.price_paid} required onChange={calculatePricePerHour}/>
                        </div>
                         <div className="p-3 bg-slate-50 rounded-lg self-end">
                            <span className="text-sm text-slate-600">Price per hour: </span>
                            <span className="font-semibold text-slate-800">{formatCurrency(pricePerHour)}</span>
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                            <Label htmlFor="package-purchase-date">Purchase Date *</Label>
                            <Input id="package-purchase-date" name="purchase_date" type="date" defaultValue={pkg?.purchase_date || new Date().toISOString().split('T')[0]} required/>
                        </div>
                        <div>
                            <Label htmlFor="package-expiry-date">Expiry Date *</Label>
                            <Input id="package-expiry-date" name="expiry_date" type="date" defaultValue={pkg?.expiry_date || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]} required/>
                        </div>
                    </div>
                    {pkg && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                               <Label>Hours Used</Label>
                               <Input value={pkg.hours_used || 0} readOnly className="bg-slate-50"/>
                            </div>
                            <div>
                               <Label>Status</Label>
                               <Select name="status" defaultValue={pkg.status}>
                                   <SelectTrigger><SelectValue/></SelectTrigger>
                                   <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="expired">Expired</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                   </SelectContent>
                               </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending} className="btn-primary">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {pkg ? 'Update Package' : 'Create Package'}
                        </Button>
                    </DialogFooter>
                </form>
                 <ClientSelectorDialog
                    open={clientSelectorOpen}
                    onOpenChange={setClientSelectorOpen}
                    clients={activeClients}
                    onClientSelect={(id) => {
                        setSelectedClientId(id);
                        setClientSelectorOpen(false);
                    }}
                 />
            </DialogContent>
        </Dialog>
    )
}

function SessionModal({ open, onOpenChange, clients, trainers, packages, db }: { open: boolean, onOpenChange: (open: boolean) => void, clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [clientPackages, setClientPackages] = useState<PTPackage[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
    const activeClients = useMemo(() => clients.filter(c => c.status === 'active'), [clients]);

    useEffect(() => {
        if (!open) {
            setSelectedClientId('');
            setClientPackages([]);
        }
    }, [open]);

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        const pkgs = packages.filter(p => p.client_id === clientId && p.status === 'active' && (p.hours_remaining ?? 0) > 0);
        setClientPackages(pkgs);
        setClientSelectorOpen(false);
    }
    const selectedClient = clients.find(c => c.id === selectedClientId);

     const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const packageId = formData.get('purchase_id') as string;
        const duration = parseFloat(formData.get('duration_hours') as string);
        const trainerId = formData.get('trainer_id') as string;
        const sessionDateTime = new Date(formData.get('session_datetime') as string);
        const clientIdFromForm = selectedClientId;

        if(!clientIdFromForm) {
            toast({ title: "Please select a client", variant: "destructive"});
            return;
        }

        const pkg = packages.find(p => p.id === packageId);
        const trainer = trainers.find(t => t.id === trainerId);

        if (!pkg || (pkg.hours_remaining ?? 0) < duration) {
            toast({ title: "Insufficient hours", variant: "destructive"});
            return;
        }
        if (!trainer) {
            toast({ title: "Trainer not found", variant: "destructive"});
            return;
        }

        startTransition(async () => {
            const sessionData = {
                entity_type: 'session',
                client_id: clientIdFromForm,
                purchase_id: packageId,
                trainer_id: trainerId,
                session_datetime: sessionDateTime.toISOString(),
                duration_hours: duration,
                session_status: 'completed',
                completed_by: 'Admin',
                completion_timestamp: new Date().toISOString()
            };
            const newSessionRef = await addDoc(collection(db, 'pt_sessions'), sessionData);
            
            // Update package
            const newHoursUsed = (pkg.hours_used || 0) + duration;
            const newHoursRemaining = pkg.hours_purchased - newHoursUsed;
            await updateDoc(doc(db, "pt_packages", pkg.id), {
                hours_used: newHoursUsed,
                hours_remaining: newHoursRemaining,
                status: newHoursRemaining <= 0 ? 'completed' : 'active'
            });

            // Calculate and create commission
            const monthRef = getMonthReference(sessionDateTime);
            const commissionsSnapshot = await getDocs(query(collection(db, "pt_commissions"), where("trainer_id", "==", trainerId), where("month_reference", "==", monthRef)));
            const commissions = commissionsSnapshot.docs.map(d=>d.data() as PTCommission);
            const cumulativeHoursBefore = commissions.reduce((sum, c) => sum + c.duration_hours, 0);

            const isBoxingPackage = pkg.package_name.toLowerCase().includes('boxing');
            let rate = 0;
            let commission = 0;
            let commissionType: PTCommission['commission_type'];

            if (isBoxingPackage) {
                rate = COMMISSION_PLANS.BOXING.rate!;
                commission = duration * rate;
                commissionType = 'BOXING';
            } else {
                const plan = COMMISSION_PLANS[trainer.commission_plan];
                commissionType = trainer.commission_plan;
                if (plan.rate) {
                    rate = plan.rate;
                    commission = duration * rate;
                } else if (plan && plan.tiers) {
                    const tier1Max = plan.tiers[0].maxHours;
                    const tier1Rate = plan.tiers[0].rate;
                    const tier2Rate = plan.tiers[1].rate;

                    if (cumulativeHoursBefore >= tier1Max) {
                        rate = tier2Rate;
                        commission = duration * tier2Rate;
                    } else if ((cumulativeHoursBefore + duration) <= tier1Max) {
                        rate = tier1Rate;
                        commission = duration * tier1Rate;
                    } else {
                        const hoursAtTier1 = tier1Max - cumulativeHoursBefore;
                        const hoursAtTier2 = duration - hoursAtTier1;
                        commission = (hoursAtTier1 * tier1Rate) + (hoursAtTier2 * tier2Rate);
                        rate = commission / duration; // blended rate
                    }
                }
            }
            
             const commissionData: Omit<PTCommission, 'id'> = {
                trainer_id: trainerId,
                session_id: newSessionRef.id,
                duration_hours: duration,
                hourly_rate_applied: Math.round(rate),
                commission_amount: Math.round(commission),
                cumulative_hours_before: cumulativeHoursBefore,
                cumulative_hours_after: cumulativeHoursBefore + duration,
                commission_plan: trainer.commission_plan,
                commission_type: commissionType,
                month_reference: monthRef
            };

            await addDoc(collection(db, "pt_commissions"), commissionData);

            toast({title: "Session Completed", description: `Commission of ${formatCurrency(commission)} created.`})
            onOpenChange(false);
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
             <DialogContent className="max-w-xl" onPointerDownOutside={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-radix-collection-item]') || target.closest('[role="dialog"]')) {
                    e.preventDefault();
                }
            }}>
                 <DialogHeader>
                    <DialogTitle>Complete PT Session</DialogTitle>
                </DialogHeader>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Client *</Label>
                        <div className="flex items-center gap-2">
                           <Input
                                readOnly
                                value={selectedClient?.name || 'No client selected'}
                                className="flex-1 bg-slate-100"
                            />
                            <Button type="button" variant="outline" onClick={() => setClientSelectorOpen(true)}>
                                Select Client
                            </Button>
                        </div>
                    </div>
                    
                    <div>
                        <Label>Package *</Label>
                        <Select name="purchase_id" required disabled={!selectedClientId}>
                            <SelectTrigger><SelectValue placeholder="Select Package"/></SelectTrigger>
                            <SelectContent>
                               {clientPackages.length === 0 ? <p className="p-2 text-sm text-slate-500">No active packages for this client.</p> : clientPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.package_name} ({p.hours_remaining}h left)</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label>Trainer *</Label>
                        <Select name="trainer_id" required>
                            <SelectTrigger><SelectValue placeholder="Select Trainer"/></SelectTrigger>
                            <SelectContent>
                                {trainers.filter(t => t.status === 'active').map(t=> <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <Label>Date & Time *</Label>
                           <Input name="session_datetime" type="datetime-local" defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} required/>
                        </div>
                        <div>
                           <Label>Duration (hours) *</Label>
                            <Select name="duration_hours" defaultValue="1" required>
                               <SelectTrigger><SelectValue/></SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="1">1 hour</SelectItem>
                                   <SelectItem value="1.5">1.5 hours</SelectItem>
                                   <SelectItem value="2">2 hours</SelectItem>
                               </SelectContent>
                           </Select>
                        </div>
                    </div>
                     <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending} className="btn-primary">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Complete Session
                        </Button>
                    </DialogFooter>
                </form>
                
                 <ClientSelectorDialog
                    open={clientSelectorOpen}
                    onOpenChange={setClientSelectorOpen}
                    clients={activeClients}
                    onClientSelect={handleClientSelect}
                 />
            </DialogContent>
        </Dialog>
    )
}

function ClientSelectorDialog({ open, onOpenChange, clients, onClientSelect }: { open: boolean, onOpenChange: (open: boolean) => void, clients: PTClient[], onClientSelect: (id: string) => void }) {
    const [clientSearch, setClientSearch] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    const filteredClientsForSearch = useMemo(() => clientSearch
        ? clients.filter(client =>
            client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
            (client.member_id && client.member_id.toLowerCase().includes(clientSearch.toLowerCase()))
          )
        : clients, [clients, clientSearch]);

    useEffect(() => {
        if (open) {
            setClientSearch('');
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Select a Client</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        ref={searchInputRef}
                        placeholder="Search by name or ID..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                    />
                    <ScrollArea className="h-72 mt-4">
                        {filteredClientsForSearch.length === 0 ? (
                            <p className="p-2 text-center text-sm text-slate-500">No client found.</p>
                        ) : (
                            <div className="space-y-1 p-1">
                                {filteredClientsForSearch.map((client) => (
                                    <Button
                                        key={client.id}
                                        variant="ghost"
                                        type="button"
                                        className="w-full justify-start text-left h-auto"
                                        onClick={() => onClientSelect(client.id)}
                                    >
                                        <div>
                                            <p className="font-medium">{client.name}</p>
                                            <p className="text-xs text-slate-500">{client.member_id}</p>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function PDFExportModal({ open, onOpenChange, trainers, commissions, sessions, clients }: { open: boolean, onOpenChange: (open: boolean) => void, trainers: PTTrainer[], commissions: PTCommission[], sessions: PTSession[], clients: PTClient[] }) {
    const { toast } = useToast();

    const generatePayoutsPDF = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const trainerId = formData.get('trainerId') as string;
        const period = formData.get('period') as string;

        if (!trainerId) {
            toast({ title: "Please select a trainer", variant: "destructive" });
            return;
        }

        const trainer = trainers.find(t => t.id === trainerId);
        if (!trainer) {
            toast({ title: "Trainer not found", variant: "destructive" });
            return;
        }

        let filteredCommissions = commissions.filter(c => c.trainer_id === trainerId);
        if (period && period !== 'all') {
            filteredCommissions = filteredCommissions.filter(c => c.month_reference === period);
        }
        
        filteredCommissions.sort((a,b) => (a.cumulative_hours_after || 0) - (b.cumulative_hours_after || 0));

        const totalHours = filteredCommissions.reduce((sum, c) => sum + (c.duration_hours || 0), 0);
        const totalEarned = filteredCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);

        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Training Report - ${trainer.name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; color: #333; line-height: 1.4; background: white; }
                    .container { max-width: 900px; margin: 0 auto; padding: 30px 20px; }
                    .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h1 { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
                    .header-info { font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .info-row { display: flex; justify-content: space-between; font-size: 12px; }
                    .info-label { font-weight: bold; width: 35%; }
                    .info-value { text-align: right; width: 65%; }
                    h2 { font-size: 14px; font-weight: bold; margin-top: 18px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #000; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background: #f0f0f0; color: #000; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 11px; border: 1px solid #999; }
                    td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; }
                    tr:nth-child(even) { background: #fafafa; }
                    .amount { text-align: right; font-weight: bold; }
                    .total-row { background: #e8e8e8; font-weight: bold; border-top: 2px solid #000; }
                    .summary-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
                    .summary-card { border: 1px solid #999; padding: 10px; text-align: center; }
                    .summary-card .label { font-size: 10px; font-weight: bold; margin-bottom: 6px; }
                    .summary-card .value { font-size: 16px; font-weight: bold; }
                    .no-data { text-align: center; padding: 20px; color: #666; background: #f5f5f5; border: 1px solid #ccc; }
                    .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
                    @media print {
                        body { margin: 0; padding: 0; }
                        .container { padding: 15px; }
                        .header { page-break-after: avoid; }
                        h2 { page-break-after: avoid; }
                        table { page-break-inside: auto; }
                        tr { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>TRAINING REPORT</h1>
                        <div class="header-info">
                            <div><strong>Trainer:</strong> ${trainer.name}</div>
                            <div><strong>Plan:</strong> ${trainer.commission_plan || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="summary-cards">
                        <div class="summary-card">
                            <div class="label">Hours Delivered</div>
                            <div class="value">${totalHours}h</div>
                        </div>
                        <div class="summary-card">
                            <div class="label">Total Earned</div>
                            <div class="value">${formatCurrency(totalEarned)}</div>
                        </div>
                        <div class="summary-card">
                            <div class="label">Period</div>
                            <div class="value">${period || 'All'}</div>
                        </div>
                    </div>
        `;

        if (filteredCommissions.length > 0) {
            htmlContent += `
                <h2>COMMISSION SUMMARY</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Client</th>
                            <th>Plan Type</th>
                            <th>Hours</th>
                            <th>Rate/Hour</th>
                            <th>Cumulative</th>
                            <th style="text-align: right;">Commission</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            filteredCommissions.forEach(comm => {
                const session = sessions.find(s => s.id === comm.session_id);
                const client = clients.find(c => c.id === session?.client_id);
                const dateStr = session?.session_datetime ? new Date(session.session_datetime).toLocaleDateString('en-GB') : '-';
                const planName = comm.commission_type === 'BOXING' ? 'Boxing' : COMMISSION_PLANS[comm.commission_plan]?.name;
                
                htmlContent += `
                    <tr>
                        <td>${dateStr}</td>
                        <td>${client?.name || '-'}</td>
                        <td>${planName}</td>
                        <td>${comm.duration_hours || 0}h</td>
                        <td>${formatCurrency(comm.hourly_rate_applied || 0)}</td>
                        <td>${comm.cumulative_hours_before || 0}→${comm.cumulative_hours_after || 0}h</td>
                        <td class="amount">${formatCurrency(comm.commission_amount || 0)}</td>
                    </tr>
                `;
            });

            htmlContent += `
                    <tr class="total-row">
                        <td colspan="6" style="text-align: right;">TOTAL:</td>
                        <td class="amount">${formatCurrency(totalEarned)}</td>
                    </tr>
                </tbody>
                </table>
            `;
        } else {
            htmlContent += `<h2>COMMISSION SUMMARY</h2><div class="no-data">No commission records found for the selected period.</div>`;
        }

        htmlContent += `
                    <div class="footer">
                        <p>Generated on ${new Date().toLocaleString('th-TH')}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '', 'width=1000,height=800');
        if (!printWindow) {
            toast({ title: 'Please allow pop-ups to download PDF', variant: 'destructive' });
            return;
        }

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.onafterprint = function() {
                printWindow.close();
            };
        }, 300);

        onOpenChange(false);
        toast({ title: 'PDF ready!', description: 'Click "Save as PDF" in the print dialog to download.' });
    };

    const months = [...new Set(commissions.map(c => c.month_reference))].sort().reverse();
    const activeTrainers = trainers.filter(t => t.status === 'active');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generate Payouts Report</DialogTitle>
                </DialogHeader>
                <form onSubmit={generatePayoutsPDF} className="space-y-4">
                    <div>
                        <Label htmlFor="pdf-trainer">Select Trainer *</Label>
                        <Select name="trainerId" required>
                            <SelectTrigger id="pdf-trainer">
                                <SelectValue placeholder="Select a trainer to export" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeTrainers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 mt-1">Select specific trainer to generate report</p>
                    </div>
                    <div>
                        <Label htmlFor="pdf-period">Filter by Period (Optional)</Label>
                        <Select name="period" defaultValue="all">
                            <SelectTrigger id="pdf-period">
                                <SelectValue placeholder="All Periods" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Periods</SelectItem>
                                {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Generate PDF</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteButton({ type, id, name, db }: { type: string, id: string, name: string, db: Firestore }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    
    const handleDelete = () => {
        startTransition(async () => {
            try {
                // When deleting a session, must also delete associated commission.
                if (type === 'session') {
                    const q = query(collection(db, "pt_commissions"), where("session_id", "==", id));
                    const commissionSnapshot = await getDocs(q);
                    if(!commissionSnapshot.empty){
                         await deleteDoc(doc(db, "pt_commissions", commissionSnapshot.docs[0].id));
                    }
                }
                
                await deleteDoc(doc(db, `pt_${type}s`, id));
                toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} Deleted` });
                setOpen(false);
            } catch {
                toast({ title: "Error", description: `Could not delete ${type}.`, variant: "destructive" });
            }
        });
    }

    return (
        <>
            <button onClick={() => setOpen(true)} className="text-red-600 hover:text-red-800">Delete</button>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone and will permanently delete this {type}.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

    
