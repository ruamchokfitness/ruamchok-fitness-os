
"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, ClipboardList, Search, Filter, History, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function AuditLogPageContent() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [moduleFilter, setFilterModule] = useState('all');
    const [actionFilter, setFilterAction] = useState('all');

    // Fetch the last 200 logs
    const logsQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'auditLogs'), orderBy('timestamp', 'desc'), limit(200)) : null,
        [firestore]
    );
    const { data: logs, isLoading } = useCollection<any>(logsQuery);

    const filteredLogs = useMemo(() => {
        if (!logs) return [];
        return logs.filter(log => {
            const matchesSearch = 
                log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.resourceId?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
            const matchesAction = actionFilter === 'all' || log.action === actionFilter;

            return matchesSearch && matchesModule && matchesAction;
        });
    }, [logs, searchQuery, moduleFilter, actionFilter]);

    const formatTimestamp = (ts: any) => {
        if (!ts) return '-';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString('th-TH', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const generateExcelReport = () => {
        if (filteredLogs.length === 0) {
            toast({ title: "No data", description: "No logs to export.", variant: "destructive" });
            return;
        }

        let csvContent = "\uFEFF"; 
        const headers = ["Timestamp", "User", "Module", "Action", "Resource ID", "Details"];
        csvContent += headers.join(",") + "\n";

        filteredLogs.forEach(log => {
            const row = [
                `"${formatTimestamp(log.timestamp)}"`,
                `"${log.userName || ''}"`,
                `"${log.module || ''}"`,
                `"${log.action || ''}"`,
                `"${log.resourceId || ''}"`,
                `"${(log.details || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Audit_Log_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'create': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">CREATE</Badge>;
            case 'update': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">UPDATE</Badge>;
            case 'delete': return <Badge variant="destructive">DELETE</Badge>;
            default: return <Badge variant="outline">{action?.toUpperCase()}</Badge>;
        }
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
                        <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                            <ClipboardList className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">System Audit Log</h1>
                            <p className="text-slate-300 text-sm md:text-base">Track all changes and deletions within the system.</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto py-8">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <CardTitle>Change History</CardTitle>
                                <CardDescription>Showing recent administrative activities across all modules.</CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <Button variant="outline" onClick={generateExcelReport}><Download className="mr-2 h-4 w-4"/>Export Excel</Button>
                                <div className="relative flex-1 md:min-w-[250px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search by user, detail, ID..." 
                                        className="pl-10"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <Select value={moduleFilter} onValueChange={setFilterModule}>
                                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Module"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Modules</SelectItem>
                                        <SelectItem value="Sales">Sales</SelectItem>
                                        <SelectItem value="HRM">HRM</SelectItem>
                                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                                        <SelectItem value="GroupClass">Group Class</SelectItem>
                                        <SelectItem value="PTTracker">PT Tracker</SelectItem>
                                        <SelectItem value="Assessment">Assessment</SelectItem>
                                        <SelectItem value="Settings">Settings</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={actionFilter} onValueChange={setFilterAction}>
                                    <SelectTrigger className="w-[120px]"><SelectValue placeholder="Action"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Actions</SelectItem>
                                        <SelectItem value="create">Create</SelectItem>
                                        <SelectItem value="update">Update</SelectItem>
                                        <SelectItem value="delete">Delete</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : filteredLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[180px]">Date & Time</TableHead>
                                            <TableHead>User</TableHead>
                                            <TableHead>Module</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Resource ID</TableHead>
                                            <TableHead className="min-w-[300px]">Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLogs.map((log) => (
                                            <TableRow key={log.id} className="hover:bg-slate-50">
                                                <TableCell className="text-xs font-mono">{formatTimestamp(log.timestamp)}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">{log.userName?.charAt(0)}</div>
                                                        <span className="font-medium text-sm">{log.userName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline">{log.module}</Badge></TableCell>
                                                <TableCell>{getActionBadge(log.action)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-mono">{log.resourceId}</TableCell>
                                                <TableCell className="text-sm">{log.details}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500">
                                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No matching audit logs found.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </>
    );
}

export default function AuditLogPage() {
    return (
        <FirebaseClientProvider>
            <AuditLogPageContent />
        </FirebaseClientProvider>
    );
}
