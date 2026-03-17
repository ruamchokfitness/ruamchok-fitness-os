"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, orderBy, where } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell, Line, ComposedChart, CartesianGrid } from 'recharts';

import type { PTClient, PTTrainer, PTPackage, PTSession, PTCommission } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Users, Award, Calendar as CalendarIcon, BarChart2, Settings, Trash2, Trophy, User, Package, Briefcase } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Firestore } from 'firebase/firestore';


const COMMISSION_PLANS: { [key: string]: { name: string; tiers: { maxHours: number; rate: number }[] } } = {
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
    }
};

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
            if (clients && clients.length > 0) return;
            const batch = writeBatch(db);
            const demoClients = [
                { name: 'Alice Johnson', email: 'alice@example.com', phone: '081-234-5678', status: 'active' },
                { name: 'Bob Williams', email: 'bob@example.com', phone: '082-345-6789', status: 'active' },
            ];
            demoClients.forEach(c => batch.set(doc(collection(db, "pt_clients")), c));

            const demoTrainers = [
                { name: 'Chris Evans', email: 'chris@rcf.com', phone: '091-111-2222', commission_plan: 'PLAN_A', status: 'active' },
                { name: 'Diana Prince', email: 'diana@rcf.com', phone: '092-222-3333', commission_plan: 'PLAN_B', status: 'active' },
            ];
            demoTrainers.forEach(t => batch.set(doc(collection(db, "pt_trainers")), t));
            await batch.commit();
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
                            <TabsTrigger value="clients">Clients</TabsTrigger>
                            <TabsTrigger value="trainers">Trainers</TabsTrigger>
                            <TabsTrigger value="packages">PT Packages</TabsTrigger>
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
                     <TabsContent value="packages">
                        <PackagesTab packages={packages||[]} clients={clients||[]} db={db} />
                    </TabsContent>
                    <TabsContent value="sessions">
                        <SessionsTab sessions={sessions||[]} clients={clients||[]} trainers={trainers||[]} packages={packages||[]} db={db} />
                    </TabsContent>
                    <TabsContent value="commissions">
                        <CommissionsTab commissions={commissions||[]} trainers={trainers||[]} sessions={sessions||[]} />
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

// Helper Functions
const formatCurrency = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatDateTime = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const getMonthReference = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;


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

function TablePlaceholder() {
    return (
        <TableRow>
            <TableCell colSpan={7} className="text-center h-24 text-slate-500">
                No data available.
            </TableCell>
        </TableRow>
    )
}

// Clients Tab
function ClientsTab({ clients, packages, db }: { clients: PTClient[], packages: PTPackage[], db: Firestore }) {
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<PTClient | null>(null);

    const filteredClients = useMemo(() => 
        clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    , [clients, search]);

    const handleEdit = (client: PTClient) => {
        setSelectedClient(client);
        setModalOpen(true);
    }
    const handleAddNew = () => {
        setSelectedClient(null);
        setModalOpen(true);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Input type="text" placeholder="Search clients..." className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
                <Button onClick={handleAddNew} className="btn-primary"><Plus className="mr-2"/> Add Client</Button>
            </div>
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Active Packages</TableHead>
                            <TableHead>Hours Remaining</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredClients.length === 0 ? <TablePlaceholder /> : filteredClients.map(client => {
                            const clientPackages = packages.filter(p => p.client_id === client.id && p.status === 'active');
                            const totalHours = clientPackages.reduce((sum, p) => sum + (p.hours_remaining || 0), 0);
                            return (
                                <TableRow key={client.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold">
                                                {client.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <span className="font-medium text-slate-800">{client.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p>{client.email}</p>
                                        <p className="text-sm text-slate-500">{client.phone}</p>
                                    </TableCell>
                                    <TableCell>{clientPackages.length}</TableCell>
                                    <TableCell><span className={`font-semibold ${totalHours > 0 ? 'text-green-600' : 'text-slate-400'}`}>{totalHours} hours</span></TableCell>
                                    <TableCell><Badge variant="outline" className={`badge-${client.status}`}>{client.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <button onClick={() => handleEdit(client)} className="text-primary-600 hover:text-primary-800 mr-3">Edit</button>
                                        <DeleteButton type="client" id={client.id} name={client.name} db={db} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            <ClientModal open={modalOpen} onOpenChange={setModalOpen} client={selectedClient} db={db} />
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 border-2 border-primary-200">
                    <h4 className="font-semibold text-primary-700 mb-2">Plan A</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                        <p>Hours 1-70: <span className="font-semibold">150 THB/hour</span></p>
                        <p>Hours 71+: <span className="font-semibold">180 THB/hour</span></p>
                    </div>
                </Card>
                <Card className="p-4 border-2 border-green-200">
                    <h4 className="font-semibold text-green-700 mb-2">Plan B</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                        <p>Hours 1-70: <span className="font-semibold">180 THB/hour</span></p>
                        <p>Hours 71+: <span className="font-semibold">200 THB/hour</span></p>
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
                            const plan = COMMISSION_PLANS[trainer.commission_plan];
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
                                        <Badge variant="outline" className={trainer.commission_plan === 'PLAN_A' ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700'}>{COMMISSION_PLANS[trainer.commission_plan]?.name || 'Not Set'}</Badge>
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
function PackagesTab({ packages, clients, db }: { packages: PTPackage[], clients: PTClient[], db: Firestore }) { 
    const [filter, setFilter] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<PTPackage | null>(null);

     const filteredPackages = useMemo(() => 
        packages.filter(p => filter === 'all' || p.status === filter)
    , [packages, filter]);

    const handleEdit = (pkg: PTPackage) => {
        setSelectedPackage(pkg);
        setModalOpen(true);
    }
    const handleAddNew = () => {
        setSelectedPackage(null);
        setModalOpen(true);
    }
    return (
         <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={handleAddNew} className="btn-primary"><Plus className="mr-2"/> Add Package</Button>
            </div>
             <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Package</TableHead>
                            <TableHead>Hours</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Valid Until</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPackages.length === 0 ? <TablePlaceholder/> : filteredPackages.map(pkg => {
                            const client = clients.find(c => c.id === pkg.client_id);
                            const progress = pkg.hours_purchased > 0 ? ((pkg.hours_used || 0) / pkg.hours_purchased * 100) : 0;
                            return (
                                <TableRow key={pkg.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold">
                                                {client?.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <span className="font-medium text-slate-800">{client?.name || 'Unknown'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-800">{pkg.package_name}</TableCell>
                                    <TableCell>
                                        <div className="w-32">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-500">{pkg.hours_used || 0} used</span>
                                                <span className={`font-semibold ${(pkg.hours_remaining || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>{pkg.hours_remaining || 0} left</span>
                                            </div>
                                            <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                                                <div className="bg-gradient-to-r from-sky-400 to-sky-600 h-full" style={{width: `${progress}%`}}></div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold text-slate-800">{formatCurrency(pkg.price_paid)}</p>
                                        <p className="text-xs text-slate-500">{formatCurrency(pkg.price_per_hour)}/hr</p>
                                    </TableCell>
                                    <TableCell>{formatDate(pkg.expiry_date)}</TableCell>
                                    <TableCell><Badge variant="outline" className={`badge-${pkg.status}`}>{pkg.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                         <button onClick={() => handleEdit(pkg)} className="text-primary-600 hover:text-primary-800 mr-3">Edit</button>
                                        <DeleteButton type="package" id={pkg.id} name={pkg.package_name} db={db} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            <PackageModal open={modalOpen} onOpenChange={setModalOpen} pkg={selectedPackage} clients={clients} db={db} />
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

function CommissionsTab({ commissions, trainers, sessions }: { commissions: PTCommission[], trainers: PTTrainer[], sessions: PTSession[] }) { 
    const [trainerFilter, setTrainerFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    
    const months = useMemo(() => [...new Set(commissions.map(c => c.month_reference))].sort().reverse(), [commissions]);

    const filteredCommissions = useMemo(() => {
        return commissions.filter(c => 
            (trainerFilter === 'all' || c.trainer_id === trainerFilter) && 
            (monthFilter === 'all' || c.month_reference === monthFilter)
        );
    }, [commissions, trainerFilter, monthFilter]);

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
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trainers.filter(t=> t.status === 'active').map(trainer => {
                    const thisMonthRef = getMonthReference();
                    const monthCommissions = commissions.filter(c => c.trainer_id === trainer.id && c.month_reference === thisMonthRef);
                    const totalHours = monthCommissions.reduce((sum, c) => sum + c.duration_hours, 0);
                    const totalEarnings = monthCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
                    const plan = COMMISSION_PLANS[trainer.commission_plan];
                    const tier = totalHours > 70 ? 'Tier 2' : 'Tier 1';

                     return (
                        <Card key={trainer.id} className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-lg">
                                    {trainer.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800">{trainer.name}</h4>
                                    <Badge variant="outline" className={trainer.commission_plan === 'PLAN_A' ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700'}>{plan?.name || 'No Plan'}</Badge>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Hours (${thisMonthRef})</span>
                                    <span className="font-semibold text-slate-800">{totalHours}h</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Current Tier</span>
                                    <span className={`font-semibold ${totalHours > 70 ? 'text-green-600' : 'text-slate-800'}`}>{tier}</span>
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
                            return (
                                <TableRow key={comm.id}>
                                    <TableCell>{formatDateTime(session?.session_datetime)}</TableCell>
                                    <TableCell>{trainer?.name || 'Unknown'}</TableCell>
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
        </div>
    )
}

// Client Modal
function ClientModal({ open, onOpenChange, client, db }: { open: boolean, onOpenChange: (open: boolean) => void, client: PTClient | null, db: Firestore }) {
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
        };

        startTransition(async () => {
            try {
                if (client) {
                    await updateDoc(doc(db, "pt_clients", client.id), data);
                    toast({ title: "Client Updated" });
                } else {
                    await addDoc(collection(db, "pt_clients"), { ...data, entity_type: 'client' });
                    toast({ title: "Client Added" });
                }
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
                    <DialogTitle>{client ? 'Edit Client' : 'Add New Client'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="client-name">Full Name *</Label>
                        <Input id="client-name" name="name" defaultValue={client?.name || ''} required />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="client-email">Email</Label>
                            <Input id="client-email" name="email" type="email" defaultValue={client?.email || ''} />
                        </div>
                        <div>
                            <Label htmlFor="client-phone">Phone</Label>
                            <Input id="client-phone" name="phone" type="tel" defaultValue={client?.phone || ''} />
                        </div>
                    </div>
                     <div>
                        <Label htmlFor="client-status">Status</Label>
                        <Select name="status" defaultValue={client?.status || 'active'}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending} className="btn-primary">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {client ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
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
            commission_plan: formData.get('commission_plan') as 'PLAN_A' | 'PLAN_B'
        };

        startTransition(async () => {
            try {
                if (trainer) {
                    await updateDoc(doc(db, "pt_trainers", trainer.id), data);
                    toast({ title: "Trainer Updated" });
                } else {
                    await addDoc(collection(db, "pt_trainers"), { ...data, entity_type: 'trainer' });
                    toast({ title: "Trainer Added" });
                }
                onOpenChange(false);
            } catch (error) {
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

function PackageModal({ open, onOpenChange, pkg, clients, db }: { open: boolean, onOpenChange: (open: boolean) => void, pkg: PTPackage | null, clients: PTClient[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [pricePerHour, setPricePerHour] = useState(pkg?.price_per_hour || 0);

    const calculatePricePerHour = (e: React.ChangeEvent<HTMLInputElement>) => {
        const form = e.target.form;
        if (!form) return;
        const hours = parseFloat((form.elements.namedItem('hours_purchased') as HTMLInputElement).value) || 0;
        const price = parseFloat((form.elements.namedItem('price_paid') as HTMLInputElement).value) || 0;
        setPricePerHour(hours > 0 ? price / hours : 0);
    }

     useEffect(() => {
        if(pkg) {
            setPricePerHour(pkg.price_per_hour || 0);
        } else {
            setPricePerHour(0);
        }
    }, [pkg, open]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const hours = parseFloat(formData.get('hours_purchased') as string);
        const price = parseFloat(formData.get('price_paid') as string);
        const data = {
            client_id: formData.get('client_id') as string,
            package_name: formData.get('package_name') as string,
            hours_purchased: hours,
            price_paid: price,
            price_per_hour: hours > 0 ? price / hours : 0,
            purchase_date: formData.get('purchase_date') as string,
            expiry_date: formData.get('expiry_date') as string,
            status: pkg ? (formData.get('status') as string) : 'active',
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{pkg ? 'Edit Package' : 'Create PT Package'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="package-client">Client *</Label>
                            <Select name="client_id" defaultValue={pkg?.client_id} required disabled={!!pkg}>
                                <SelectTrigger><SelectValue placeholder="Select Client"/></SelectTrigger>
                                <SelectContent>
                                    {clients.filter(c=> c.status === 'active').map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="package-name">Package Name *</Label>
                            <Input id="package-name" name="package_name" defaultValue={pkg?.package_name} required />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="package-hours">Hours Purchased *</Label>
                            <Input id="package-hours" name="hours_purchased" type="number" min="1" defaultValue={pkg?.hours_purchased} required onChange={calculatePricePerHour}/>
                        </div>
                        <div>
                            <Label htmlFor="package-price">Total Price (THB) *</Label>
                            <Input id="package-price" name="price_paid" type="number" min="0" defaultValue={pkg?.price_paid} required onChange={calculatePricePerHour}/>
                        </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Price per hour: </span>
                        <span className="font-semibold text-slate-800">{formatCurrency(pricePerHour)}</span>
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
                            {pkg ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function SessionModal({ open, onOpenChange, clients, trainers, packages, db }: { open: boolean, onOpenChange: (open: boolean) => void, clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[], db: Firestore }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [clientPackages, setClientPackages] = useState<PTPackage[]>([]);
    
    const handleClientChange = (clientId: string) => {
        const pkgs = packages.filter(p => p.client_id === clientId && p.status === 'active' && (p.hours_remaining ?? 0) > 0);
        setClientPackages(pkgs);
    }

     const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const packageId = formData.get('purchase_id') as string;
        const duration = parseFloat(formData.get('duration_hours') as string);
        const trainerId = formData.get('trainer_id') as string;
        const sessionDateTime = new Date(formData.get('session_datetime') as string);

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
                client_id: formData.get('client_id') as string,
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
            const commissions = (await getDocs(query(collection(db, "pt_commissions"), where("trainer_id", "==", trainerId), where("month_reference", "==", monthRef)))).docs.map(d=>d.data() as PTCommission);
            const cumulativeHoursBefore = commissions.reduce((sum, c) => sum + c.duration_hours, 0);
            
            const plan = COMMISSION_PLANS[trainer.commission_plan];
            let rate = 0; let commission = 0;
            if (plan) {
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
             const commissionData = {
                entity_type: 'commission',
                trainer_id: trainerId,
                session_id: newSessionRef.id,
                duration_hours: duration,
                hourly_rate_applied: Math.round(rate),
                commission_amount: Math.round(commission),
                cumulative_hours_before: cumulativeHoursBefore,
                cumulative_hours_after: cumulativeHoursBefore + duration,
                commission_plan: trainer.commission_plan,
                month_reference: monthRef
            };

            await addDoc(collection(db, "pt_commissions"), commissionData);

            toast({title: "Session Completed", description: `Commission of ${formatCurrency(commission)} created.`})
            onOpenChange(false);
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                 <DialogHeader>
                    <DialogTitle>Complete PT Session</DialogTitle>
                </DialogHeader>
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                        <Label>Client *</Label>
                        <Select name="client_id" onValueChange={handleClientChange} required>
                            <SelectTrigger><SelectValue placeholder="Select Client"/></SelectTrigger>
                            <SelectContent>
                                {clients.filter(c => c.status === 'active').map(c=> <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                      <div>
                        <Label>Package *</Label>
                        <Select name="purchase_id" required>
                            <SelectTrigger><SelectValue placeholder="Select Package"/></SelectTrigger>
                            <SelectContent>
                               {clientPackages.length === 0 ? <p className="p-2 text-sm text-slate-500">No active packages.</p> : clientPackages.map(p => <SelectItem key={p.id} value={p.id}>{p.package_name} (${p.hours_remaining}h left)</SelectItem>)}
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
            </DialogContent>
        </Dialog>
    )
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
