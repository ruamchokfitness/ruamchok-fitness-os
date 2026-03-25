"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { PTClient } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, User, Search, ArrowLeft } from 'lucide-react';

function ClientSelectionPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    const clientsQuery = useMemoFirebase(() => firestore ? collection(firestore, "pt_clients") : null, [firestore]);
    const { data: clients, isLoading } = useCollection<PTClient>(clientsQuery);

    const filteredClients = useMemo(() => {
        if (!clients) return [];
        return clients.filter(client => 
            client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.member_id?.toLowerCase().includes(searchQuery.toLowerCase())
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [clients, searchQuery]);

    return (
        <>
            <header className="bg-slate-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">Member Sign-in</h1>
                            <p className="text-slate-300 text-sm md:text-base">Select a client to start a session.</p>
                        </div>
                    </div>
                    <Link href="/" className="md:hidden">
                        <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                </div>
            </header>
            <main className="container mx-auto py-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Client</CardTitle>
                        <div className="relative mt-2">
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
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredClients.map(client => (
                                    <Link key={client.id} href={`/member-signin/${client.id}`} passHref>
                                        <Card className="hover:bg-primary/5 hover:shadow-lg transition-all cursor-pointer">
                                            <CardContent className="p-4 flex items-center gap-4">
                                                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                                                    {client.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800">{client.name}</p>
                                                    <p className="text-sm text-slate-500">{client.member_id || 'No ID'}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                         {(!isLoading && filteredClients.length === 0) && (
                            <p className="text-center text-slate-500 py-10">No clients found.</p>
                        )}
                    </CardContent>
                </Card>
            </main>
        </>
    );
}

export default function MemberSigninPage() {
    return (
        <FirebaseClientProvider>
            <ClientSelectionPage />
        </FirebaseClientProvider>
    );
}

    
