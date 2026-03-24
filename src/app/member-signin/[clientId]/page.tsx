"use client";

import React from 'react';
import { doc, collection, query, where } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import type { PTClient, PTPackage } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, FileSignature, Dumbbell, History, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

function ClientProfile({ params: paramsPromise }: { params: Promise<{ clientId: string }> }) {
    const params = React.use(paramsPromise);
    const { firestore } = useFirebase();
    const { clientId } = params;

    const clientRef = useMemoFirebase(() => firestore ? doc(firestore, 'pt_clients', clientId) : null, [firestore, clientId]);
    const { data: client, isLoading: loadingClient } = useDoc<PTClient>(clientRef);

    const packagesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'pt_packages'), where('client_id', '==', clientId), where('status', '==', 'active')) : null, [firestore, clientId]);
    const { data: activePackages, isLoading: loadingPackages } = useCollection<PTPackage>(packagesQuery);
    
    const isLoading = loadingClient || loadingPackages;
    
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
                <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">{client.name}</h1>
                        <p className="text-slate-300 text-sm md:text-base">Member ID: {client.member_id || 'N/A'}</p>
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
                                <CardTitle>Active Packages</CardTitle>
                                <CardDescription>Select a package to start a new training session.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activePackages && activePackages.length > 0 ? activePackages.map(pkg => (
                                     <Card key={pkg.id} className="p-4">
                                         <div className="flex justify-between items-center">
                                             <div>
                                                 <p className="font-semibold">{pkg.package_name}</p>
                                                 <p className="text-sm text-green-600 font-bold">{pkg.hours_remaining} hours remaining</p>
                                                 <p className="text-xs text-muted-foreground">Expires: {new Date(pkg.expiry_date).toLocaleDateString()}</p>
                                             </div>
                                             
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button>Start Session</Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Start New Session</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="py-4">
                                                        <p>Session signing and creation will be implemented here.</p>
                                                        <p className="font-semibold mt-2">Package: {pkg.package_name}</p>
                                                    </div>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                         </div>
                                     </Card>
                                )) : (
                                    <p className="text-center text-muted-foreground py-4">No active packages found.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="parq" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Physical Activity Readiness Questionnaire (PAR-Q)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">The PAR-Q form will be displayed and can be filled out here.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="history" className="mt-6">
                         <Card>
                            <CardHeader>
                                <CardTitle>Personal Table / Workout History</CardTitle>
                            </CardHeader>
                            <CardContent>
                                 <p className="text-muted-foreground">A list of past sessions and their workout details will be shown here.</p>
                            </CardContent>
                        </Card>
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
    