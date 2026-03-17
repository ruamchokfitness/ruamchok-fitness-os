"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
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
import { Loader2, Plus, Users, Award, Calendar, BarChart2, Settings, Trash2, Edit } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COMMISSION_PLANS = {
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

export default function PTTrackerPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [loading, setLoading] = useState(true);

    const [clients, setClients] = useState<PTClient[]>([]);
    const [trainers, setTrainers] = useState<PTTrainer[]>([]);
    const [packages, setPackages] = useState<PTPackage[]>([]);
    const [sessions, setSessions] = useState<PTSession[]>([]);
    const [commissions, setCommissions] = useState<PTCommission[]>([]);

    useEffect(() => {
        const unsubscribers = [
            onSnapshot(collection(db, "pt_clients"), (snapshot) => setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTClient)))),
            onSnapshot(collection(db, "pt_trainers"), (snapshot) => setTrainers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTTrainer)))),
            onSnapshot(collection(db, "pt_packages"), (snapshot) => setPackages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTPackage)))),
            onSnapshot(query(collection(db, "pt_sessions"), orderBy('session_datetime', 'desc')), (snapshot) => setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTSession)))),
            onSnapshot(collection(db, "pt_commissions"), (snapshot) => setCommissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PTCommission)))),
        ];
        
        Promise.all(unsubscribers).then(() => setLoading(false)).catch(() => setLoading(false));

        return () => unsubscribers.forEach(unsub => unsub());
    }, []);

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    return (
        <>
            <header className="bg-dark-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
                     <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">PT Session & Commission Tracker</h1>
                        <p className="text-slate-300 text-sm md:text-base">Fitness Pro Business Management</p>
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
                        <DashboardTab clients={clients} trainers={trainers} packages={packages} sessions={sessions} commissions={commissions} />
                    </TabsContent>
                    <TabsContent value="clients">
                        <ClientsTab clients={clients} packages={packages} />
                    </TabsContent>
                    <TabsContent value="trainers">
                        <TrainersTab trainers={trainers} commissions={commissions} />
                    </TabsContent>
                     <TabsContent value="packages">
                        <PackagesTab packages={packages} clients={clients} />
                    </TabsContent>
                    <TabsContent value="sessions">
                        <SessionsTab sessions={sessions} clients={clients} trainers={trainers} packages={packages} />
                    </TabsContent>
                    <TabsContent value="commissions">
                        <CommissionsTab commissions={commissions} trainers={trainers} sessions={sessions} />
                    </TabsContent>
                </div>
            </Tabs>
        </>
    )
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
                <Card className="stat-card text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium opacity-80">Total Clients</CardTitle>
                        <Users className="h-5 w-5 opacity-80" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalClients}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Trainers</CardTitle>
                        <Award className="h-5 w-5 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.activeTrainers}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sessions This Month</CardTitle>
                        <Calendar className="h-5 w-5 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.sessionsThisMonth}h</div>
                         <p className="text-xs text-muted-foreground">hours delivered</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Commission This Month</CardTitle>
                        <BarChart2 className="h-5 w-5 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatCurrency(stats.commissionThisMonth)}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader><CardTitle>Active Packages</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {stats.activePackages.length === 0 ? <p className="text-muted-foreground text-sm">No active packages</p> : 
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
                                                <span className="font-medium">{client?.name || 'Unknown'}</span>
                                                <span className="text-sm text-muted-foreground">{pkg.hours_remaining || 0}h left</span>
                                            </div>
                                            <Progress value={progress} />
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Recent Sessions</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                         {stats.recentSessions.length === 0 ? <p className="text-muted-foreground text-sm">No sessions recorded</p> : 
                            stats.recentSessions.map(session => {
                                const client = clients.find(c => c.id === session.client_id);
                                const trainer = trainers.find(t => t.id === session.trainer_id);
                                return (
                                    <div key={session.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div>
                                            <p className="font-medium">{client?.name || 'Unknown'}</p>
                                            <p className="text-sm text-muted-foreground">with {trainer?.name || 'Unknown'}</p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant={session.session_status === 'completed' ? 'default' : 'secondary'} className={`badge-${session.session_status}`}>{session.session_status}</Badge>
                                            <p className="text-xs text-muted-foreground mt-1">{formatDateTime(session.session_datetime)}</p>
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-slate-100 rounded-xl">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">from package sales</p>
                    </div>
                    <div className="text-center p-4 bg-slate-100 rounded-xl">
                        <p className="text-sm text-muted-foreground">Hours Remaining</p>
                        <p className="text-2xl font-bold mt-1">{stats.totalHoursRemaining}</p>
                        <p className="text-xs text-muted-foreground">to be delivered</p>
                    </div>
                    <div className="text-center p-4 bg-slate-100 rounded-xl">
                        <p className="text-sm text-muted-foreground">Completed Sessions</p>
                        <p className="text-2xl font-bold mt-1">{stats.completedSessionsCount}</p>
                        <p className="text-xs text-muted-foreground">total sessions</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// Clients Tab
function ClientsTab({ clients, packages }: { clients: PTClient[], packages: PTPackage[] }) {
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
                <Button onClick={handleAddNew}><Plus className="mr-2"/> Add Client</Button>
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
                        {filteredClients.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center h-24">No clients found</TableCell></TableRow>
                        ) : filteredClients.map(client => {
                            const clientPackages = packages.filter(p => p.client_id === client.id && p.status === 'active');
                            const totalHours = clientPackages.reduce((sum, p) => sum + (p.hours_remaining || 0), 0);
                            return (
                                <TableRow key={client.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold">
                                                {client.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <span className="font-medium">{client.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p>{client.email}</p>
                                        <p className="text-sm text-muted-foreground">{client.phone}</p>
                                    </TableCell>
                                    <TableCell>{clientPackages.length}</TableCell>
                                    <TableCell><span className={`font-semibold ${totalHours > 0 ? 'text-green-600' : 'text-slate-400'}`}>{totalHours} hours</span></TableCell>
                                    <TableCell><Badge className={`badge-${client.status}`}>{client.status}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}><Edit/></Button>
                                        <DeleteButton type="client" id={client.id} name={client.name} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </Card>
            <ClientModal open={modalOpen} onOpenChange={setModalOpen} client={selectedClient} />
        </div>
    )
}

// Other Tabs (Trainers, Packages, Sessions, Commissions) and Modals to be implemented similarly...
// For brevity, I'm providing a skeleton for the remaining components.

function TrainersTab({ trainers, commissions }: { trainers: PTTrainer[], commissions: PTCommission[] }) { 
    // Similar implementation to ClientsTab
    return <Card><CardHeader><CardTitle>Trainers</CardTitle></CardHeader><CardContent>Trainers content goes here</CardContent></Card>
}
function PackagesTab({ packages, clients }: { packages: PTPackage[], clients: PTClient[] }) { 
    return <Card><CardHeader><CardTitle>PT Packages</CardTitle></CardHeader><CardContent>Packages content goes here</CardContent></Card>
}
function SessionsTab({ sessions, clients, trainers, packages }: { sessions: PTSession[], clients: PTClient[], trainers: PTTrainer[], packages: PTPackage[] }) { 
    return <Card><CardHeader><CardTitle>Sessions</CardTitle></CardHeader><CardContent>Sessions content goes here</CardContent></Card>
}
function CommissionsTab({ commissions, trainers, sessions }: { commissions: PTCommission[], trainers: PTTrainer[], sessions: PTSession[] }) { 
    return <Card><CardHeader><CardTitle>Commissions</CardTitle></CardHeader><CardContent>Commissions content goes here</CardContent></Card>
}

// Client Modal
function ClientModal({ open, onOpenChange, client }: { open: boolean, onOpenChange: (open: boolean) => void, client: PTClient | null }) {
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
                    await addDoc(collection(db, "pt_clients"), data);
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
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {client ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function DeleteButton({ type, id, name }: { type: string, id: string, name: string }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    
    const handleDelete = () => {
        startTransition(async () => {
            try {
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
            <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-800" onClick={() => setOpen(true)}><Trash2/></Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone and will permanently delete this {type}.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
