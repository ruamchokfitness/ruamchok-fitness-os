
"use client";

import React, { useState, useEffect, useMemo, useTransition, useRef, useCallback } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, getDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell, Line, ComposedChart, CartesianGrid } from 'recharts';

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
import { ArrowLeft, Loader2, Plus, Users, Award, Calendar as CalendarIcon, BarChart2, Settings, Trash2, Trophy, User, Package, Briefcase, Info, Copyright, Edit, ChevronsUpDown, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Firestore } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


// Helper Functions
const formatCurrency = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatDateTime = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const getMonthReference = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

async function recalculateCommissions(db: Firestore, trainerId: string, newPlanId: PTTrainer['commission_plan'], allPlans: PTCommissionPlan[], monthRef: string) {
    const [year, month] = monthRef.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0, 23, 59, 59);

    // Simplified query to avoid composite index
    const sessionsQuery = query(
        collection(db, "pt_sessions"),
        where("trainer_id", "==", trainerId)
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);
    const allTrainerSessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTSession));

    // Filter by date range and status in-memory
    const sessionsThisMonth = allTrainerSessions
        .filter(session => {
            const sessionDate = new Date(session.session_datetime);
            return session.session_status === 'completed' && sessionDate >= firstDay && sessionDate <= lastDay;
        })
        .sort((a, b) => new Date(a.session_datetime).getTime() - new Date(b.session_datetime).getTime());

    const packagesSnapshot = await getDocs(collection(db, "pt_packages"));
    const allPackages = packagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTPackage));
    
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

    let cumulativeHoursInMonth = 0; // For tiered plans only
    let cumulativeBoxingHoursInMonth = 0; // For boxing plans
    const plan = allPlans.find(p => p.id === newPlanId);
    if (!plan) {
        console.error(`Commission plan with ID ${newPlanId} not found.`);
        // Not returning to avoid partial failure. It will just calculate 0 commission for tiered plans.
    }
    const boxingPlan = allPlans.find(p => p.id === 'BOXING');


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
        let commissionTypeName = '';
        let cumulativeBefore = 0;
        let cumulativeAfter = 0;
        
        if (isBoxingPackage && boxingPlan) {
            cumulativeBefore = cumulativeBoxingHoursInMonth;
            cumulativeBoxingHoursInMonth += duration;
            cumulativeAfter = cumulativeBoxingHoursInMonth;

            rate = boxingPlan.tiers[0].rate;
            commission = duration * rate;
            commissionTypeName = boxingPlan.name;
        } else if (plan) {
            cumulativeBefore = cumulativeHoursInMonth;
            cumulativeHoursInMonth += duration;
            cumulativeAfter = cumulativeHoursInMonth;

            commissionTypeName = plan.name;
            if (plan.tiers.length === 1) { // Fixed rate plan
                rate = plan.tiers[0].rate;
                commission = duration * rate;
            } else { // Tiered plan
                const tier1 = plan.tiers.find(t => t.maxHours !== Infinity);
                const tier2 = plan.tiers.find(t => t.maxHours === Infinity);

                if (tier1 && tier2) {
                    const tier1Max = tier1.maxHours;
                    const tier1Rate = tier1.rate;
                    const tier2Rate = tier2.rate;

                    if (cumulativeBefore >= tier1Max) {
                        rate = tier2Rate;
                        commission = duration * rate;
                    } else if ((cumulativeBefore + duration) <= tier1Max) {
                        rate = tier1Rate;
                        commission = duration * tier1Rate;
                    } else {
                        const hoursAtTier1 = tier1Max - cumulativeBefore;
                        const hoursAtTier2 = duration - hoursAtTier1;
                        commission = (hoursAtTier1 * tier1Rate) + (hoursAtTier2 * tier2Rate);
                        rate = commission / duration; // Effective blended rate
                    }
                }
            }
        }
        
        const commissionData: Omit<PTCommission, 'id'> = {
            trainer_id: trainerId,
            session_id: session.id,
            duration_hours: duration,
            hourly_rate_applied: Math.round(rate),
            commission_amount: Math.round(commission),
            cumulative_hours_before: cumulativeBefore,
            cumulative_hours_after: cumulativeAfter,
            commission_plan: isBoxingPackage ? 'BOXING' : newPlanId,
            commission_type: commissionTypeName,
            month_reference: monthRef
        };

        const newCommissionRef = doc(collection(db, "pt_commissions"));
        batch.set(newCommissionRef, commissionData);
    }

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
    const { data: commissionPlans, isLoading: l6 } = useCollection<PTCommissionPlan>(useMemoFirebase(() => db ? query(collection(db, "pt_commission_plans"), orderBy('name')) : null, [db]));
    
    const loading = l1 || l2 || l3 || l4 || l5 || l6;
    
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
    
     useEffect(() => {
        if (!db || l6) return;
        const seedCommissionPlans = async () => {
            const plansCollection = collection(db, "pt_commission_plans");
            const snapshot = await getDocs(query(plansCollection));
            if (snapshot.empty) {
                console.log("Seeding default commission plans...");
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
    const { toast } = useToast();

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

    const handleDeletePackage = async (packageId: string) => {
        try {
            await deleteDoc(doc(db, "pt_packages", packageId));
            toast({ title: "Package Deleted" });
        } catch (error) {
            console.error("Error deleting package: ", error);
            toast({ title: "Error", description: "Could not delete package.", variant: "destructive" });
        }
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
                                                            <DeleteButton type="package" name={pkg.package_name} onConfirmDelete={() => handleDeletePackage(pkg.id)} />
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
            <ClientAndPackageModal open={addClientModalOpen} onOpenChange={setAddClientModalOpen} clients={clients} db={db} />
            <ClientModal open={editClientModalOpen} onOpenChange={setEditClientModalOpen} client={selectedClient} db={db} />
            <PackageModal open={packageModalOpen} onOpenChange={setPackageModalOpen} pkg={selectedPackage} client={selectedClient} clients={clients} db={db} />
        </div>
    )
}

function TrainersTab({ trainers, commissions, commissionPlans, db }: { trainers: PTTrainer[], commissions: PTCommission[], commissionPlans: PTCommissionPlan[], db: Firestore }) { 
    const [trainerModalOpen, setTrainerModalOpen] = useState(false);
    const [plansModalOpen, setPlansModalOpen] = useState(false);
    const [selectedTrainer, setSelectedTrainer] = useState<PTTrainer | null>(null);
    const thisMonthRef = getMonthReference();
    const { toast } = useToast();

    const handleEdit = (trainer: PTTrainer) => {
        setSelectedTrainer(trainer);
        setTrainerModalOpen(true);
    }
    const handleAddNew = () => {
        setSelectedTrainer(null);
        setTrainerModalOpen(true);
    }

    const handleDeleteTrainer = async (trainerId: string) => {
        try {
            await deleteDoc(doc(db, "pt_trainers", trainerId));
            toast({ title: "Trainer Deleted" });
        } catch (error) {
            console.error("Error deleting trainer: ", error);
            toast({ title: "Error", description: "Could not delete trainer.", variant: "destructive" });
        }
    };
    
    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold text-slate-800">Trainer Roster</h3>
                <div className="flex gap-2">
                    <Button onClick={() => setPlansModalOpen(true)} variant="outline"><Settings className="mr-2"/> Manage Plans</Button>
                    <Button onClick={handleAddNew} className="btn-primary"><Plus className="mr-2"/> Add Trainer</Button>
                </div>
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
                            const plan = commissionPlans.find(p => p.id === trainer.commission_plan);
                             
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
                                        <Badge variant="outline">{plan?.name || 'Not Set'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold text-slate-800">{monthlyHours} hours</p>
                                        <p className="text-sm text-green-600">{formatCurrency(monthlyEarnings)}</p>
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className={`badge-${trainer.status}`}>{trainer.status}</Badge></TableCell>
                                     <TableCell className="text-right">
                                        <button onClick={() => handleEdit(trainer)} className="text-primary-600 hover:text-primary-800 mr-3">Edit</button>
                                        <DeleteButton type="trainer" name={trainer.name} onConfirmDelete={() => handleDeleteTrainer(trainer.id)} />
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
    const [trainerFilter, setTrainerFilter] = useState('all');
    const { toast } = useToast();
    const [sortConfig, setSortConfig] = useState<{ key: keyof PTSession | 'clientName' | 'trainerName' | 'memberId', direction: 'ascending' | 'descending' }>({ key: 'session_datetime', direction: 'descending' });
    const [checkedSessions, setCheckedSessions] = useState<string[]>([]);

    const handleCheckChange = (sessionId: string) => {
        setCheckedSessions(prev => 
            prev.includes(sessionId)
                ? prev.filter(id => id !== sessionId)
                : [...prev, sessionId]
        );
    };

    const requestSort = (key: keyof PTSession | 'clientName' | 'trainerName' | 'memberId') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedSessions = useMemo(() => {
        let sortableItems = [...sessions.filter(s => trainerFilter === 'all' || s.trainer_id === trainerFilter)];
        
        sortableItems.sort((a, b) => {
            let aValue: any, bValue: any;

            if (sortConfig.key === 'clientName') {
                aValue = clients.find(c => c.id === a.client_id)?.name || '';
                bValue = clients.find(c => c.id === b.client_id)?.name || '';
            } else if (sortConfig.key === 'memberId') {
                aValue = clients.find(c => c.id === a.client_id)?.member_id || '';
                bValue = clients.find(c => c.id === b.client_id)?.member_id || '';
            } else if (sortConfig.key === 'trainerName') {
                aValue = trainers.find(t => t.id === a.trainer_id)?.name || '';
                bValue = trainers.find(t => t.id === b.trainer_id)?.name || '';
            } else {
                 aValue = a[sortConfig.key as keyof PTSession];
                 bValue = b[sortConfig.key as keyof PTSession];
            }
            
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        return sortableItems;
    }, [sessions, trainerFilter, sortConfig, clients, trainers]);

    async function handleCompleteSession(sessionId: string) {
        const session = sessions.find(s => s.id === sessionId);
        if (!session || session.session_status !== 'scheduled') return;
        await updateDoc(doc(db, "pt_sessions", sessionId), { session_status: 'completed' });
    }
    async function handleCancelSession(sessionId: string) {
        await updateDoc(doc(db, "pt_sessions", sessionId), { session_status: 'cancelled' });
    }

    const handleEditSession = (session: PTSession) => {
        setSessionToEdit(session);
        setEditModalOpen(true);
    };

    const handleDeleteSession = async (sessionToDelete: PTSession) => {
        try {
            const batch = writeBatch(db);
            const sessionRef = doc(db, "pt_sessions", sessionToDelete.id);

            const pkg = packages.find(p => p.id === sessionToDelete.purchase_id);
            if (pkg) {
                const packageRef = doc(db, "pt_packages", pkg.id);
                const newHoursUsed = (pkg.hours_used || 0) - sessionToDelete.duration_hours;
                const newHoursRemaining = pkg.hours_purchased - newHoursUsed;
                
                batch.update(packageRef, {
                    hours_used: Math.max(0, newHoursUsed),
                    hours_remaining: newHoursRemaining,
                    status: 'active'
                });
            } else {
                 toast({ title: "Warning", description: "Could not find associated package to restore hours.", variant: "destructive" });
            }

            batch.delete(sessionRef);
            
            await batch.commit();

            const trainer = trainers.find(t => t.id === sessionToDelete.trainer_id);
            if (trainer) {
                const sessionMonthRef = getMonthReference(new Date(sessionToDelete.session_datetime));
                await recalculateCommissions(db, trainer.id, trainer.commission_plan, commissionPlans, sessionMonthRef);
            }

            toast({ title: "Session Deleted", description: "Session hours restored and commissions recalculated." });
        } catch (err) {
            console.error(err);
            toast({ title: "Error", description: "Could not delete session.", variant: "destructive" });
        }
    };

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
                 <Link href="/member-signin">
                    <Button className="btn-primary"><Plus className="mr-2"/> Sign-in Client</Button>
                </Link>
            </div>
             <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableHeader columnKey="session_datetime" sortConfig={sortConfig} requestSort={requestSort}>Date/Time</SortableHeader>
                            <SortableHeader columnKey="memberId" sortConfig={sortConfig} requestSort={requestSort}>Member ID</SortableHeader>
                            <SortableHeader columnKey="clientName" sortConfig={sortConfig} requestSort={requestSort}>Client</SortableHeader>
                            <SortableHeader columnKey="trainerName" sortConfig={sortConfig} requestSort={requestSort}>Trainer</SortableHeader>
                            <SortableHeader columnKey="duration_hours" sortConfig={sortConfig} requestSort={requestSort}>Duration</SortableHeader>
                            <SortableHeader columnKey="session_status" sortConfig={sortConfig} requestSort={requestSort}>Status</SortableHeader>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {sortedSessions.length === 0 ? <TablePlaceholder /> : sortedSessions.map(session => {
                            const client = clients.find(c => c.id === session.client_id);
                            const trainer = trainers.find(t => t.id === session.trainer_id);
                            return (
                                <TableRow key={session.id} data-state={checkedSessions.includes(session.id) ? "selected" : undefined}>
                                    <TableCell className="font-medium">{formatDateTime(session.session_datetime)}</TableCell>
                                    <TableCell>{client?.member_id || 'N/A'}</TableCell>
                                    <TableCell>{client?.name || 'Unknown'}</TableCell>
                                    <TableCell>{trainer?.name || 'Unknown'}</TableCell>
                                    <TableCell>{session.duration_hours} hr</TableCell>
                                    <TableCell><Badge variant="outline" className={`badge-${session.session_status}`}>{session.session_status}</Badge></TableCell>
                                    <TableCell>
                                        <div className="flex justify-end items-center gap-1">
                                            {session.session_status === 'scheduled' && (
                                                <>
                                                    <button onClick={() => handleCompleteSession(session.id)} className="text-green-600 hover:text-green-800" title="Mark Complete">✓</button>
                                                    <button onClick={() => handleCancelSession(session.id)} className="text-orange-600 hover:text-orange-800" title="Cancel">✕</button>
                                                </>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={() => handleEditSession(session)}>Edit</Button>
                                            <DeleteButton type="session" name={`Session for ${client?.name}`} onConfirmDelete={() => handleDeleteSession(session)} />
                                            <Checkbox id={`session-check-${session.id}`} checked={checkedSessions.includes(session.id)} onCheckedChange={() => handleCheckChange(session.id)} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            <SessionEditModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                session={sessionToEdit}
                clients={clients}
                trainers={trainers}
                packages={packages}
                commissionPlans={commissionPlans}
                db={db}
            />
        </div>
    )
}

function CommissionsTab({ commissions, trainers, sessions, clients, commissionPlans, packages }: { commissions: PTCommission[], trainers: PTTrainer[], sessions: PTSession[], clients: PTClient[], commissionPlans: PTCommissionPlan[], packages: PTPackage[] }) { 
    const [trainerFilter, setTrainerFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState(() => getMonthReference());
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof PTCommission | 'sessionDate' | 'trainerName', direction: 'ascending' | 'descending' }>({ key: 'cumulative_hours_after', direction: 'ascending' });
    
    const months = useMemo(() => [...new Set(commissions.map(c => c.month_reference))].sort().reverse(), [commissions]);

    useEffect(() => {
        if (!months.includes(monthFilter) && months.length > 0) {
            setMonthFilter(months[0]);
        } else if (months.length === 0) {
            setMonthFilter(getMonthReference());
        }
    }, [months, monthFilter]);

    const requestSort = (key: keyof PTCommission | 'sessionDate' | 'trainerName') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedCommissions = useMemo(() => {
        // 1. Initial Filtering
        const filteredMonthCommissions = commissions.filter(c => 
            (trainerFilter === 'all' || c.trainer_id === trainerFilter) && 
            (c.month_reference === monthFilter)
        );

        // Helper to get session date
        const getSessionDate = (commission: PTCommission) => {
            const session = sessions.find(s => s.id === commission.session_id);
            return session ? new Date(session.session_datetime) : new Date(0);
        };

        // 2. Separate into boxing and non-boxing
        const nonBoxingCommissions = filteredMonthCommissions
            .filter(c => c.commission_type !== 'Boxing Package')
            .sort((a, b) => getSessionDate(a).getTime() - getSessionDate(b).getTime());
        
        const boxingCommissions = filteredMonthCommissions
            .filter(c => c.commission_type === 'Boxing Package')
            .sort((a, b) => getSessionDate(a).getTime() - getSessionDate(b).getTime());

        // 3. Recalculate cumulative hours for each group
        let cumulativeHours = 0;
        const recalculatedNonBoxing = nonBoxingCommissions.map(comm => {
            const newComm = { ...comm };
            newComm.cumulative_hours_before = cumulativeHours;
            cumulativeHours += newComm.duration_hours;
            newComm.cumulative_hours_after = cumulativeHours;
            return newComm;
        });

        let cumulativeBoxingHours = 0;
        const recalculatedBoxing = boxingCommissions.map(comm => {
            const newComm = { ...comm };
            newComm.cumulative_hours_before = cumulativeBoxingHours;
            cumulativeBoxingHours += newComm.duration_hours;
            newComm.cumulative_hours_after = cumulativeBoxingHours;
            return newComm;
        });
        
        // 4. Combine and apply final sort configuration
        let combined = [...recalculatedNonBoxing, ...recalculatedBoxing];

        combined.sort((a, b) => {
            // Keep boxing at the end
            const aIsBoxing = a.commission_type === 'Boxing Package';
            const bIsBoxing = b.commission_type === 'Boxing Package';
            if (aIsBoxing && !bIsBoxing) return 1;
            if (!aIsBoxing && bIsBoxing) return -1;

            let aValue: any, bValue: any;
            
            // The rest of the sorting logic from the original hook
            if (sortConfig.key === 'sessionDate') {
                aValue = getSessionDate(a).getTime();
                bValue = getSessionDate(b).getTime();
            } else if (sortConfig.key === 'trainerName') {
                aValue = trainers.find(t => t.id === a.trainer_id)?.name || '';
                bValue = trainers.find(t => t.id === b.trainer_id)?.name || '';
            } else {
                 aValue = a[sortConfig.key as keyof PTCommission];
                 bValue = b[sortConfig.key as keyof PTCommission];
            }
            
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });

        return combined;

    }, [commissions, trainerFilter, monthFilter, sortConfig, sessions, trainers]);
    
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
                     <Input
                        type="month"
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="w-[180px]"
                    />
                </div>
                 <Button onClick={() => setPdfModalOpen(true)}>
                    <Info className="mr-2 h-4 w-4" />
                    Generate PDF
                </Button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTrainersForCards.map(trainer => {
                    const monthCommissions = commissions.filter(c => c.trainer_id === trainer.id && (c.month_reference === monthFilter));
                    const totalHours = monthCommissions.reduce((sum, c) => sum + (c.duration_hours || 0), 0);
                    const totalEarned = monthCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
                    const plan = commissionPlans.find(p => p.id === trainer.commission_plan);
                     
                    return (
                        <Card key={trainer.id} className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-lg">
                                    {trainer.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800">{trainer.name}</h4>
                                    <Badge variant="outline">{plan?.name || 'No Plan'}</Badge>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Hours ({monthFilter})</span>
                                    <span className="font-semibold text-slate-800">{totalHours}h</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-slate-100 pt-2 mt-2">
                                    <span className="text-slate-500">Total Earnings</span>
                                    <span className="font-bold text-green-600">{formatCurrency(totalEarned)}</span>
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
                            <SortableHeader columnKey="sessionDate" sortConfig={sortConfig} requestSort={requestSort}>Date</SortableHeader>
                            <SortableHeader columnKey="trainerName" sortConfig={sortConfig} requestSort={requestSort}>Trainer</SortableHeader>
                            <SortableHeader columnKey="commission_type" sortConfig={sortConfig} requestSort={requestSort}>Plan</SortableHeader>
                            <SortableHeader columnKey="duration_hours" sortConfig={sortConfig} requestSort={requestSort}>Hours</SortableHeader>
                            <SortableHeader columnKey="hourly_rate_applied" sortConfig={sortConfig} requestSort={requestSort}>Rate</SortableHeader>
                            <SortableHeader columnKey="cumulative_hours_after" sortConfig={sortConfig} requestSort={requestSort}>Cumulative</SortableHeader>
                            <SortableHeader columnKey="commission_amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right">Commission</SortableHeader>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedCommissions.length === 0 ? <TablePlaceholder/> : sortedCommissions.map(comm => {
                            const trainer = trainers.find(t => t.id === comm.trainer_id);
                            const session = sessions.find(s => s.id === comm.session_id);
                            return (
                                <TableRow key={comm.id}>
                                    <TableCell>{formatDateTime(session?.session_datetime)}</TableCell>
                                    <TableCell>{trainer?.name || 'Unknown'}</TableCell>
                                    <TableCell><Badge variant="outline" className={comm.commission_type === 'Boxing Package' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}>{comm.commission_type}</Badge></TableCell>
                                    <TableCell>{comm.duration_hours}h</TableCell>
                                    <TableCell>{formatCurrency(comm.hourly_rate_applied)}/hr</TableCell>
                                    <TableCell>{comm.cumulative_hours_before || 0}h → {comm.cumulative_hours_after || 0}h</TableCell>
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
                commissionPlans={commissionPlans}
                packages={packages}
            />
        </div>
    )
}

function SortableHeader({ children, columnKey, sortConfig, requestSort, className }: { children: React.ReactNode, columnKey: string, sortConfig: {key: string, direction: string}, requestSort: (key: string) => void, className?: string }) {
    const isSortedAsc = sortConfig.key === columnKey && sortConfig.direction === 'ascending';
    const isSortedDesc = sortConfig.key === columnKey && sortConfig.direction === 'descending';

    return (
        <TableHead onClick={() => requestSort(columnKey)} className={cn("cursor-pointer select-none", className)}>
            <div className="flex items-center gap-2">
                {children}
                {isSortedAsc && <ArrowUp className="h-4 w-4" />}
                {isSortedDesc && <ArrowDown className="h-4 w-4" />}
                {!isSortedAsc && !isSortedDesc && <ArrowUpDown className="h-4 w-4 opacity-30" />}
            </div>
        </TableHead>
    );
};

function ClientAndPackageModal({ open, onOpenChange, db, clients }: { open: boolean, onOpenChange: (open: boolean) => void, db: Firestore, clients: PTClient[] }) {
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
            member_id: (formData.get('member_id') as string || '').trim(),
            phone: formData.get('phone') as string,
            status: 'active' as 'active' | 'inactive',
        };

        if (clientData.member_id && clients.some(c => c.member_id === clientData.member_id)) {
            toast({
                title: "Member ID already exists",
                description: "This Member ID is already in use. Please enter a unique ID.",
                variant: "destructive",
            });
            return;
        }

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
            status: formData.get('status') as 'active' | 'inactive',
            commission_plan: formData.get('commission_plan') as string
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
                            const currentMonthRef = getMonthReference();
                            await recalculateCommissions(db, trainer.id, data.commission_plan, commissionPlans, currentMonthRef);
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
                                    {(commissionPlans || []).map(plan => (
                                        <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                    ))}
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
    const [clientSearch, setClientSearch] = useState('');
    const [isClientListOpen, setIsClientListOpen] = useState(false);
    
    const activeClients = useMemo(() => clients.filter(c => c.status === 'active'), [clients]);
    
    const filteredClientsForSearch = useMemo(() => clientSearch
        ? activeClients.filter(client =>
            client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
            (client.member_id && client.member_id.toLowerCase().includes(clientSearch.toLowerCase()))
          )
        : activeClients, [activeClients, clientSearch]);

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
                const currentClient = clients.find(c => c.id === pkg.client_id);
                setClientSearch(currentClient?.name || '');
            } else if (client) {
                setSelectedClientId(client.id);
                setClientSearch(client.name);
                setPricePerHour(0);
            } else {
                setSelectedClientId('');
                setClientSearch('');
                setPricePerHour(0);
            }
        }
    }, [pkg, client, open, clients]);
    

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const hours = parseFloat(formData.get('hours_purchased') as string);
        const price = parseFloat(formData.get('price_paid') as string);
        const clientIdFromForm = selectedClientId;
        const hoursUsed = pkg ? (parseFloat((formData.get('hours_used') as HTMLInputElement)?.value) || 0) : 0;
        
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
            hours_used: hoursUsed,
            hours_remaining: hours - hoursUsed,
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

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        const client = clients.find(c => c.id === clientId);
        setClientSearch(client?.name || '');
        setIsClientListOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{pkg ? 'Edit Package' : 'Add New Package'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                     {!pkg && (
                        <div className="space-y-2">
                            <Label>Client *</Label>
                            <div className="relative">
                                <Input
                                    placeholder="Search by name or ID..."
                                    value={clientSearch}
                                    onChange={(e) => {
                                        setClientSearch(e.target.value);
                                        setSelectedClientId('');
                                        setIsClientListOpen(true);
                                    }}
                                    onFocus={() => setIsClientListOpen(true)}
                                    onBlur={() => setTimeout(() => setIsClientListOpen(false), 150)}
                                    autoComplete="off"
                                />
                                {isClientListOpen && filteredClientsForSearch.length > 0 && (
                                    <Card className="absolute top-full mt-1 w-full z-50">
                                        <CardContent className="p-0">
                                            <ScrollArea className="h-48">
                                                {filteredClientsForSearch.map((client) => (
                                                    <div
                                                        key={client.id}
                                                        className="p-2 hover:bg-accent cursor-pointer"
                                                        onMouseDown={() => handleClientSelect(client.id)}
                                                    >
                                                        <p className="font-medium">{client.name}</p>
                                                        <p className="text-xs text-muted-foreground">{client.member_id}</p>
                                                    </div>
                                                ))}
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                )}
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
                               <Label htmlFor="package-hours-used">Hours Used</Label>
                               <Input id="package-hours-used" name="hours_used" type="number" step="0.1" defaultValue={pkg.hours_used || 0} />
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
            </DialogContent>
        </Dialog>
    )
}

function SessionEditModal({ open, onOpenChange, session: sessionToEdit, clients, trainers, packages, db, commissionPlans }: { open: boolean, onOpenChange: (open: boolean) => void, session: PTSession | null, clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], db: Firestore, commissionPlans: PTCommissionPlan[] }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [sessionDateTime, setSessionDateTime] = useState('');
    const [trainerId, setTrainerId] = useState('');
    const [duration, setDuration] = useState('1');

    useEffect(() => {
        if (sessionToEdit) {
            setSessionDateTime(new Date(new Date(sessionToEdit.session_datetime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
            setTrainerId(sessionToEdit.trainer_id);
            setDuration(String(sessionToEdit.duration_hours));
        }
    }, [sessionToEdit]);

    const client = useMemo(() => {
        if (!sessionToEdit) return null;
        return clients.find(c => c.id === sessionToEdit.client_id);
    }, [clients, sessionToEdit]);

    if (!sessionToEdit) {
        return null; 
    }

    const pkg = packages.find(p => p.id === sessionToEdit.purchase_id);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pkg) { 
            toast({ title: "Package not found", variant: "destructive" });
            return;
        }

        const newDuration = parseFloat(duration);
        const hourDiff = newDuration - sessionToEdit.duration_hours;
        const currentRemaining = pkg.hours_remaining || 0;

        if (hourDiff > currentRemaining) {
            toast({ title: "Insufficient hours in package", description: `Not enough hours to increase duration. Available: ${currentRemaining}h`, variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                const batch = writeBatch(db);

                const pkgRef = doc(db, "pt_packages", pkg.id);
                const newHoursUsed = (pkg.hours_used || 0) + hourDiff;
                const newHoursRemaining = pkg.hours_purchased - newHoursUsed;
                batch.update(pkgRef, {
                    hours_used: newHoursUsed,
                    hours_remaining: newHoursRemaining,
                    status: newHoursRemaining <= 0 ? 'completed' : 'active'
                });

                const sessionRef = doc(db, "pt_sessions", sessionToEdit.id);
                batch.update(sessionRef, {
                    session_datetime: new Date(sessionDateTime).toISOString(),
                    trainer_id: trainerId,
                    duration_hours: newDuration
                });

                await batch.commit();

                const originalMonthRef = getMonthReference(new Date(sessionToEdit.session_datetime));
                const newMonthRef = getMonthReference(new Date(sessionDateTime));
                const trainersToUpdate = new Set<string>([sessionToEdit.trainer_id, trainerId]);

                for (const tId of trainersToUpdate) {
                    const trainer = trainers.find(t => t.id === tId);
                    if (trainer) {
                        await recalculateCommissions(db, tId, trainer.commission_plan, commissionPlans, originalMonthRef);
                        if (originalMonthRef !== newMonthRef) {
                            await recalculateCommissions(db, tId, trainer.commission_plan, commissionPlans, newMonthRef);
                        }
                    }
                }
                
                toast({ title: "Session Updated Successfully" });
                onOpenChange(false);
            } catch (error) {
                console.error("Error updating session: ", error);
                toast({ title: "Error updating session", variant: "destructive" });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Edit Session</DialogTitle>
                    <DialogDescription>For client: {client?.name}</DialogDescription>
                </DialogHeader>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Package</Label>
                        <Input readOnly value={`${pkg?.package_name} (${pkg?.hours_remaining}h left)`} className="bg-slate-100" />
                    </div>
                     <div>
                        <Label htmlFor="edit-session-trainer">Trainer *</Label>
                        <Select name="trainer_id" value={trainerId} onValueChange={setTrainerId} required>
                            <SelectTrigger id="edit-session-trainer"><SelectValue placeholder="Select Trainer"/></SelectTrigger>
                            <SelectContent>
                                {trainers.filter(t => t.status === 'active').map(t=> <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <Label htmlFor="edit-session-datetime">Date & Time *</Label>
                           <Input id="edit-session-datetime" name="session_datetime" type="datetime-local" value={sessionDateTime} onChange={e => setSessionDateTime(e.target.value)} required/>
                        </div>
                        <div>
                           <Label htmlFor="edit-session-duration">Duration (hours) *</Label>
                            <Select name="duration_hours" value={duration} onValueChange={setDuration} required>
                               <SelectTrigger id="edit-session-duration"><SelectValue/></SelectTrigger>
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
                            Update Session
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function PDFExportModal({ open, onOpenChange, trainers, commissions, sessions, clients, commissionPlans, packages }: { open: boolean, onOpenChange: (open: boolean) => void, trainers: PTTrainer[], commissions: PTCommission[], sessions: PTSession[], clients: PTClient[], commissionPlans: PTCommissionPlan[], packages: PTPackage[] }) {
    const { toast } = useToast();
    const [trainerId, setTrainerId] = useState('');
    const [monthFilter, setMonthFilter] = useState(() => getMonthReference());


    const generatePayoutsPDF = () => {
        if (!trainerId) {
            toast({ title: "Please select a trainer", variant: "destructive" });
            return;
        }

        const trainer = trainers.find(t => t.id === trainerId);
        if (!trainer) {
            toast({ title: "Trainer not found", variant: "destructive" });
            return;
        }
        const plan = commissionPlans.find(p => p.id === trainer.commission_plan);

        let filteredCommissions = commissions.filter(c => c.trainer_id === trainerId && c.month_reference === monthFilter);
        
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
                    td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; vertical-align: middle; }
                    tr:nth-child(even) { background: #fafafa; }
                    .amount { text-align: right; font-weight: bold; }
                    .total-row { background: #e8e8e8; font-weight: bold; border-top: 2px solid #000; }
                    .summary-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
                    .summary-card { border: 1px solid #999; padding: 10px; text-align: center; }
                    .summary-card .label { font-size: 10px; font-weight: bold; margin-bottom: 6px; }
                    .summary-card .value { font-size: 16px; font-weight: bold; }
                    .no-data { text-align: center; padding: 20px; color: #666; background: #f5f5f5; border: 1px solid #ccc; }
                    .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
                    .signature { max-height: 25px; width: auto; }
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
                            <div><strong>Plan:</strong> ${plan?.name || 'N/A'}</div>
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
                            <div class="value">${monthFilter}</div>
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
                            <th>Package Name</th>
                            <th>Hrs Purchased</th>
                            <th>Rate/Hour</th>
                            <th>Cumulative</th>
                            <th style="text-align: right;">Commission</th>
                            <th>Client Sign</th>
                            <th>Trainer Sign</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            filteredCommissions.forEach(comm => {
                const session = sessions.find(s => s.id === comm.session_id);
                const client = clients.find(c => c.id === session?.client_id);
                const pkg = packages.find(p => p.id === session?.purchase_id);
                const dateStr = session?.session_datetime ? new Date(session.session_datetime).toLocaleDateString('en-GB') : '-';
                const clientSignHTML = session?.clientSignature ? `<img src="${session.clientSignature}" class="signature" alt="Client Signature">` : '-';
                const trainerSignHTML = session?.trainerSignature ? `<img src="${session.trainerSignature}" class="signature" alt="Trainer Signature">` : '-';
                
                htmlContent += `
                    <tr>
                        <td>${dateStr}</td>
                        <td>${client?.name || '-'}</td>
                        <td>${pkg?.package_name || '-'}</td>
                        <td>${pkg?.hours_purchased ? `${pkg.hours_purchased}h` : '-'}</td>
                        <td>${formatCurrency(comm.hourly_rate_applied || 0)}</td>
                        <td>${comm.cumulative_hours_before || 0}→${comm.cumulative_hours_after || 0}h</td>
                        <td class="amount">${formatCurrency(comm.commission_amount || 0)}</td>
                        <td>${clientSignHTML}</td>
                        <td>${trainerSignHTML}</td>
                    </tr>
                `;
            });

            htmlContent += `
                    <tr class="total-row">
                        <td colspan="6" style="text-align: right;">TOTAL:</td>
                        <td class="amount">${formatCurrency(totalEarned)}</td>
                        <td colspan="2"></td>
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

    const activeTrainers = trainers.filter(t => t.status === 'active');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generate Payouts Report</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div>
                        <Label htmlFor="pdf-trainer">Select Trainer *</Label>
                        <Select name="trainerId" required value={trainerId} onValueChange={setTrainerId}>
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
                        <Label htmlFor="pdf-period">Filter by Month</Label>
                        <Input id="pdf-period" type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="button" onClick={generatePayoutsPDF}>Generate PDF</Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DeleteButton({ type, name, onConfirmDelete }: { type: string, name: string, onConfirmDelete: () => void }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    
    const handleConfirm = () => {
        startTransition(async () => {
            await onConfirmDelete();
            setOpen(false);
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
                        <AlertDialogAction onClick={handleConfirm} className="bg-red-600 hover:bg-red-700" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
    


function ManagePlansDialog({ open, onOpenChange, plans, trainers, db }: { open: boolean, onOpenChange: (open: boolean) => void, plans: PTCommissionPlan[], trainers: PTTrainer[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [editingPlan, setEditingPlan] = useState<PTCommissionPlan | null>(null);

    const [planName, setPlanName] = useState('');
    const [planType, setPlanType] = useState<'TIERED' | 'FIXED'>('TIERED');
    const [tier1Hours, setTier1Hours] = useState('');
    const [tier1Rate, setTier1Rate] = useState('');
    const [tier2Rate, setTier2Rate] = useState('');
    const [fixedRate, setFixedRate] = useState('');

    const resetForm = () => {
        setEditingPlan(null);
        setPlanName('');
        setPlanType('TIERED');
        setTier1Hours('');
        setTier1Rate('');
        setTier2Rate('');
        setFixedRate('');
    }

    useEffect(() => {
        if (!open) {
            resetForm();
        }
    }, [open]);
    
    const handleEdit = (plan: PTCommissionPlan) => {
        setEditingPlan(plan);
        setPlanName(plan.name);
        if (plan.tiers.length > 1) {
            setPlanType('TIERED');
            const tier1 = plan.tiers.find(t => t.maxHours !== Infinity);
            const tier2 = plan.tiers.find(t => t.maxHours === Infinity);
            setTier1Hours(String(tier1?.maxHours || ''));
            setTier1Rate(String(tier1?.rate || ''));
            setTier2Rate(String(tier2?.rate || ''));
            setFixedRate('');
        } else {
            setPlanType('FIXED');
            setFixedRate(String(plan.tiers[0]?.rate || ''));
            setTier1Hours('');
            setTier1Rate('');
            setTier2Rate('');
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            if (!planName) {
                toast({ title: "Plan name is required", variant: 'destructive' });
                return;
            }

            let tiers: PTCommissionTier[] = [];
            if (planType === 'FIXED') {
                const rate = parseFloat(fixedRate);
                if (isNaN(rate) || rate < 0) {
                    toast({ title: "Invalid fixed rate", variant: 'destructive' });
                    return;
                }
                tiers = [{ maxHours: Infinity, rate }];
            } else {
                const t1Hours = parseFloat(tier1Hours);
                const t1Rate = parseFloat(tier1Rate);
                const t2Rate = parseFloat(tier2Rate);
                if (isNaN(t1Hours) || t1Hours <= 0 || isNaN(t1Rate) || t1Rate < 0 || isNaN(t2Rate) || t2Rate < 0) {
                    toast({ title: "Invalid tier values", variant: 'destructive' });
                    return;
                }
                tiers = [{ maxHours: t1Hours, rate: t1Rate }, { maxHours: Infinity, rate: t2Rate }];
            }
            
            const planData = { name: planName, tiers, isDeletable: true };

            try {
                if (editingPlan) {
                    await updateDoc(doc(db, "pt_commission_plans", editingPlan.id), planData);
                    toast({ title: "Plan updated successfully" });
                } else {
                    await addDoc(collection(db, "pt_commission_plans"), planData);
                    toast({ title: "Plan created successfully" });
                }
                resetForm();
            } catch (error) {
                console.error("Error saving plan:", error);
                toast({ title: "Error saving plan", variant: 'destructive' });
            }
        });
    }

    const handleDelete = (plan: PTCommissionPlan) => {
        if (!plan.isDeletable) {
            toast({ title: "Cannot delete default plan", variant: 'destructive' });
            return;
        }
        const isPlanInUse = trainers.some(t => t.commission_plan === plan.id);
        if (isPlanInUse) {
            toast({ title: "Cannot delete plan", description: "This plan is currently assigned to one or more trainers.", variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            try {
                await deleteDoc(doc(db, "pt_commission_plans", plan.id));
                toast({ title: "Plan deleted successfully" });
                if (editingPlan?.id === plan.id) {
                    resetForm();
                }
            } catch (error) {
                toast({ title: "Error deleting plan", variant: 'destructive' });
            }
        });
    }


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader><DialogTitle>Manage Commission Plans</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <h4 className="font-semibold mb-2 text-slate-700">Existing Plans</h4>
                        <ScrollArea className="h-96 pr-4">
                            <div className="space-y-2">
                                {(plans || []).map(p => (
                                    <Card key={p.id} className={`p-3 ${editingPlan?.id === p.id ? 'border-primary' : ''}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{p.name}</p>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {p.tiers.length === 1 ? `Fixed: ${formatCurrency(p.tiers[0].rate)}/hr` : 
                                                    `Tiers: ${p.tiers.map(t => `${formatCurrency(t.rate)}`).join(' / ')}`}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(p)}><Edit className="h-4 w-4"/></Button>
                                                {p.isDeletable && <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(p)}><Trash2 className="h-4 w-4"/></Button>}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2 text-slate-700">{editingPlan ? 'Edit Plan' : 'Add New Plan'}</h4>
                        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-slate-50">
                            <div>
                                <Label htmlFor="plan-name">Plan Name</Label>
                                <Input id="plan-name" value={planName} onChange={e => setPlanName(e.target.value)} required/>
                            </div>
                            <div>
                                <Label>Plan Type</Label>
                                <Select value={planType} onValueChange={(v: 'TIERED' | 'FIXED') => setPlanType(v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TIERED">Tiered Rate</SelectItem>
                                        <SelectItem value="FIXED">Fixed Rate</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {planType === 'FIXED' ? (
                                <div>
                                    <Label htmlFor="fixed-rate">Rate per Hour</Label>
                                    <Input id="fixed-rate" type="number" placeholder="250" value={fixedRate} onChange={e => setFixedRate(e.target.value)}/>
                                </div>
                            ) : (
                                <div className="space-y-2 border p-3 rounded-md">
                                    <p className="text-sm font-medium">Tiers</p>
                                     <div>
                                        <Label htmlFor="tier1-hours">Tier 1: Up to (hours)</Label>
                                        <Input id="tier1-hours" type="number" placeholder="70" value={tier1Hours} onChange={e => setTier1Hours(e.target.value)}/>
                                    </div>
                                     <div>
                                        <Label htmlFor="tier1-rate">Tier 1: Rate per Hour</Label>
                                        <Input id="tier1-rate" type="number" placeholder="180" value={tier1Rate} onChange={e => setTier1Rate(e.target.value)}/>
                                    </div>
                                     <div>
                                        <Label htmlFor="tier2-rate">Tier 2: Rate (Above Tier 1)</Label>
                                        <Input id="tier2-rate" type="number" placeholder="200" value={tier2Rate} onChange={e => setTier2Rate(e.target.value)}/>
                                    </div>
                                </div>
                            )}
                             <div className="flex justify-end gap-2 pt-4">
                                {editingPlan && <Button type="button" variant="ghost" onClick={resetForm}>Cancel Edit</Button>}
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    {editingPlan ? 'Save Changes' : 'Create Plan'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
                 <DialogFooter className="mt-4">
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SessionSigningDialog({ client, pkg, trainers, commissionPlans, children }: SessionSigningDialogProps) {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    const { control, handleSubmit, formState: { errors }, reset } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            duration: '1',
            trainerId: '',
            clientSignature: '',
            trainerSignature: '',
        }
    });

    const processSubmit = async (data: z.infer<typeof formSchema>) => {
        const sessionDuration = parseFloat(data.duration);
        const trainer = trainers.find(t => t.id === data.trainerId);

        if (!trainer) {
            toast({ title: "Trainer not found", variant: "destructive"});
            return;
        }

        if ((pkg.hours_remaining ?? 0) < sessionDuration) {
            toast({ title: "Insufficient hours", description: `This package only has ${pkg.hours_remaining} hours remaining.`, variant: "destructive"});
            return;
        }

        startTransition(async () => {
            if (!db) return;
            try {
                const sessionDateTime = new Date();

                // 1. Create Session
                const sessionData: Omit<PTSession, 'id'> = {
                    client_id: client.id,
                    purchase_id: pkg.id,
                    trainer_id: data.trainerId,
                    session_datetime: sessionDateTime.toISOString(),
                    duration_hours: sessionDuration,
                    session_status: 'completed',
                    completed_by: trainer.name,
                    completion_timestamp: sessionDateTime.toISOString(),
                    clientSignature: data.clientSignature,
                    trainerSignature: data.trainerSignature
                };
                const newSessionRef = await addDoc(collection(db, 'pt_sessions'), sessionData);
                
                // 2. Update Package
                const newHoursUsed = (pkg.hours_used || 0) + sessionDuration;
                const newHoursRemaining = pkg.hours_purchased - newHoursUsed;
                await updateDoc(doc(db, "pt_packages", pkg.id), {
                    hours_used: newHoursUsed,
                    hours_remaining: newHoursRemaining,
                    status: newHoursRemaining <= 0 ? 'completed' : 'active'
                });

                // 3. Calculate and Create Commission
                const monthRef = getMonthReference(sessionDateTime);
                const commissionsSnapshot = await getDocs(query(collection(db, "pt_commissions"), where("trainer_id", "==", data.trainerId), where("month_reference", "==", monthRef)));
                const commissionsInMonth = commissionsSnapshot.docs.map(d=>d.data() as PTCommission);
                
                const cumulativeHoursBefore = commissionsInMonth
                    .filter(c => c.commission_type !== 'Boxing Package')
                    .reduce((sum, c) => sum + c.duration_hours, 0);

                const cumulativeBoxingHoursBefore = commissionsInMonth
                    .filter(c => c.commission_type === 'Boxing Package')
                    .reduce((sum, c) => sum + c.duration_hours, 0);

                let rate = 0;
                let commission = 0;
                let commissionTypeName = '';
                let finalCumulativeBefore = 0;
                let finalCumulativeAfter = 0;
                
                const isBoxingPackage = pkg.package_name.toLowerCase().includes('boxing');
                const boxingPlan = commissionPlans.find(p => p.id === 'BOXING');
                const trainerPlan = commissionPlans.find(p => p.id === trainer.commission_plan);

                if (isBoxingPackage && boxingPlan) {
                    finalCumulativeBefore = cumulativeBoxingHoursBefore;
                    finalCumulativeAfter = cumulativeBoxingHoursBefore + sessionDuration;

                    rate = boxingPlan.tiers[0].rate;
                    commission = sessionDuration * rate;
                    commissionTypeName = boxingPlan.name;
                } else if (trainerPlan) {
                    finalCumulativeBefore = cumulativeHoursBefore;
                    finalCumulativeAfter = cumulativeHoursBefore + sessionDuration;

                    commissionTypeName = trainerPlan.name;
                    if (trainerPlan.tiers.length === 1) { // Fixed rate plan
                        rate = trainerPlan.tiers[0].rate;
                        commission = sessionDuration * rate;
                    } else { // Tiered plan
                        const tier1 = trainerPlan.tiers.find(t => t.maxHours !== Infinity);
                        const tier2 = trainerPlan.tiers.find(t => t.maxHours === Infinity);
                        if(tier1 && tier2) {
                            const { maxHours: tier1Max, rate: tier1Rate } = tier1;
                            const { rate: tier2Rate } = tier2;

                            if (cumulativeHoursBefore >= tier1Max) {
                                rate = tier2Rate;
                                commission = sessionDuration * tier2Rate;
                            } else if ((cumulativeHoursBefore + sessionDuration) <= tier1Max) {
                                rate = tier1Rate;
                                commission = sessionDuration * tier1Rate;
                            } else {
                                const hoursAtTier1 = tier1Max - cumulativeHoursBefore;
                                const hoursAtTier2 = sessionDuration - hoursAtTier1;
                                commission = (hoursAtTier1 * tier1Rate) + (hoursAtTier2 * tier2Rate);
                                rate = commission / sessionDuration; // blended rate
                            }
                        }
                    }
                }
                
                const commissionData: Omit<PTCommission, 'id'> = {
                    trainer_id: data.trainerId,
                    session_id: newSessionRef.id,
                    duration_hours: sessionDuration,
                    hourly_rate_applied: Math.round(rate),
                    commission_amount: Math.round(commission),
                    cumulative_hours_before: finalCumulativeBefore,
                    cumulative_hours_after: finalCumulativeAfter,
                    commission_plan: isBoxingPackage ? 'BOXING' : trainer.commission_plan,
                    commission_type: commissionTypeName,
                    month_reference: monthRef
                };
                await addDoc(collection(db, "pt_commissions"), commissionData);

                toast({title: "Session Completed Successfully!", description: `Commission of ${formatCurrency(commission)} created for ${trainer.name}.`});
                reset();
                setOpen(false);
            } catch (error) {
                console.error("Error completing session:", error);
                toast({ title: "Error", description: "Failed to complete the session.", variant: "destructive" });
            }
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Start New Session: {client.name}</DialogTitle>
                    <DialogDescription>Package: {pkg.package_name} ({pkg.hours_used || 0}/{pkg.hours_purchased} hours used)</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(processSubmit)}>
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="session-trainer">Trainer</Label>
                                <Controller
                                    name="trainerId"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger id="session-trainer"><SelectValue placeholder="Select Trainer"/></SelectTrigger>
                                            <SelectContent>
                                                {trainers.filter(t => t.status === 'active').map(t=> <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.trainerId && <p className="text-xs text-destructive mt-1">{errors.trainerId.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="session-duration">Duration</Label>
                                <Controller
                                    name="duration"
                                    control={control}
                                    defaultValue="1"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger id="session-duration"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 hour</SelectItem>
                                                <SelectItem value="1.5">1.5 hours</SelectItem>
                                                <SelectItem value="2">2 hours</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Controller
                                    name="clientSignature"
                                    control={control}
                                    render={({ field }) => (
                                        <SignaturePad label="Client Signature" onSignatureChange={field.onChange} />
                                    )}
                                />
                                {errors.clientSignature && <p className="text-xs text-destructive mt-1">{errors.clientSignature.message}</p>}
                            </div>
                            <div>
                                <Controller
                                    name="trainerSignature"
                                    control={control}
                                    render={({ field }) => (
                                        <SignaturePad label="Trainer Signature" onSignatureChange={field.onChange} />
                                    )}
                                />
                                {errors.trainerSignature && <p className="text-xs text-destructive mt-1">{errors.trainerSignature.message}</p>}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4 pt-4 border-t">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4"/>}
                            Confirm & Complete Session
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}