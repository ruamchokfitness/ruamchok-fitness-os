
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import type { PTClient, PTPackage, PTTrainer, PTCommissionPlan, PTSession } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, User, FileSignature, History, FileText, ChevronsUpDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionSigningDialog } from '@/components/pt/session-signing-dialog';
import { SessionHistoryTable } from '@/components/pt/session-history-table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ParqForm } from '@/components/pt/parq-form';
import { PersonalTable } from '@/components/pt/personal-table';


function ClientProfile({ params: paramsPromise }: { params: Promise<{ clientId: string }> }) {
    const params = React.use(paramsPromise);
    const { firestore } = useFirebase();
    const { clientId } = params;

    const clientRef = useMemoFirebase(() => firestore ? doc(firestore, 'pt_clients', clientId) : null, [firestore, clientId]);
    const { data: client, isLoading: loadingClient } = useDoc<PTClient>(clientRef);

    // Fetch all packages for the client
    const allPackagesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'pt_packages'), where('client_id', '==', clientId)) : null, [firestore, clientId]);
    const { data: allPackagesData, isLoading: loadingPackages } = useCollection<PTPackage>(allPackagesQuery);

    // Fetch all sessions for this client to calculate accurate usage
    const sessionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'pt_sessions'), where('client_id', '==', clientId)) : null, [firestore, clientId]);
    const { data: sessions, isLoading: loadingSessions } = useCollection<PTSession>(sessionsQuery);

    const allPackages = useMemo(() => {
        if (!allPackagesData) return [];
        
        // Calculate usage map from actual sessions for 100% accuracy
        const usageMap: Record<string, number> = {};
        if (sessions) {
            sessions.forEach(s => {
                if (!usageMap[s.purchase_id]) usageMap[s.purchase_id] = 0;
                usageMap[s.purchase_id] += (s.duration_hours || 0);
            });
        }

        return allPackagesData
            .map(pkg => ({
                ...pkg,
                hours_used: usageMap[pkg.id] || 0,
                hours_remaining: pkg.hours_purchased - (usageMap[pkg.id] || 0)
            }))
            .sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (a.status !== 'active' && b.status === 'active') return 1;
                return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
            });
    }, [allPackagesData, sessions]);
    
    const trainersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'pt_trainers') : null, [firestore]);
    const { data: trainers, isLoading: loadingTrainers } = useCollection<PTTrainer>(trainersQuery);
    
    const commissionPlansQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'pt_commission_plans'), orderBy('name')) : null, [firestore]);
    const { data: commissionPlans, isLoading: loadingPlans } = useCollection<PTCommissionPlan>(commissionPlansQuery);

    const isLoading = loadingClient || loadingPackages || loadingSessions || loadingTrainers || loadingPlans;
    
    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <p>Client not found.</p>
            </div>
        );
    }

    return (
        <>
             <header className="bg-slate-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/member-signin">
                            <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">{client.name}</h1>
                            <p className="text-slate-300 text-sm md:text-base">Member ID: {client.member_id || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto py-8">
                 <Tabs defaultValue="signin" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="signin"><FileSignature className="mr-2 h-4 w-4"/>Sign-in & Start Session</TabsTrigger>
                        <TabsTrigger value="parq"><FileText className="mr-2 h-4 w-4"/>PAR-Q</TabsTrigger>
                        <TabsTrigger value="history"><History className="mr-2 h-4 w-4"/>Workout History</TabsTrigger>
                    </TabsList>
                    <TabsContent value="signin" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Client Packages</CardTitle>
                                <CardDescription>Select an active package to start a new session, or view history for any package.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {allPackages && allPackages.length > 0 ? allPackages.map(pkg => (
                                     <Card key={pkg.id} className="p-0 overflow-hidden">
                                        <div className="p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-xl">{pkg.package_name}</p>
                                                    {pkg.status === 'active' || pkg.hours_remaining > 0 ? (
                                                        <p className="text-sm text-green-600 font-bold">{pkg.hours_remaining || 0}/{pkg.hours_purchased} hours remaining</p>
                                                    ) : (
                                                        <p className="text-sm text-red-600 font-bold capitalize">{pkg.status}</p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">Expires: {new Date(pkg.expiry_date).toLocaleDateString()}</p>
                                                </div>
                                                
                                                {(pkg.status === 'active' || pkg.hours_remaining > 0) && (
                                                    <SessionSigningDialog
                                                        client={client}
                                                        pkg={pkg}
                                                        trainers={trainers || []}
                                                        commissionPlans={commissionPlans || []}
                                                    >
                                                        <Button>Start Session</Button>
                                                    </SessionSigningDialog>
                                                )}
                                            </div>
                                        </div>

                                        <Collapsible>
                                            <CollapsibleTrigger asChild>
                                                <div className="bg-slate-50 hover:bg-slate-100 cursor-pointer p-2 border-t text-center text-sm font-medium text-muted-foreground">
                                                    <div className="flex items-center justify-center">
                                                        <ChevronsUpDown className="h-4 w-4 mr-2"/>
                                                        View Session History
                                                    </div>
                                                </div>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <div className="p-4 bg-slate-50">
                                                    <SessionHistoryTable packageId={pkg.id} trainers={trainers || []} />
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </Card>
                                )) : (
                                    <p className="text-center text-muted-foreground py-4">No packages found for this client.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="parq" className="mt-6">
                        <ParqForm client={client} />
                    </TabsContent>
                    <TabsContent value="history" className="mt-6">
                         <PersonalTable
                            clientId={client.id}
                            packages={allPackages || []}
                         />
                    </TabsContent>
                </Tabs>
            </main>
        </>
    );
}

export default function ClientProfilePage({ params }: { params: Promise<{ clientId: string }> }) {
    return (
        <FirebaseClientProvider>
            <ClientProfile params={params} />
        </FirebaseClientProvider>
    );
}
