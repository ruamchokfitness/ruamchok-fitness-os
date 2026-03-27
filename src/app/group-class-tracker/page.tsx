
"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { collection, addDoc, doc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { GroupClass, GroupClassInstructor, GroupClassTime, GroupClassAttendance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Settings, Trash2, Save, FilePenLine, History, BarChart3, TrendingUp, Lightbulb, Users2, Dumbbell, UserSquare, Clock, X, Trophy, TrendingDown, Star, Ban, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { SignaturePad } from '@/components/ui/signature-pad';

function GroupClassTrackerPageContent() {
    const { firestore: db } = useFirebase();
    const [isPending, startTransition] = useTransition();

    const [activeTab, setActiveTab] = useState("signin");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ collection: string, id: string } | null>(null);

    const { data: classes, isLoading: l1 } = useCollection<GroupClass>(useMemoFirebase(() => db ? query(collection(db, "groupClasses"), orderBy('name')) : null, [db]));
    const { data: instructors, isLoading: l2 } = useCollection<GroupClassInstructor>(useMemoFirebase(() => db ? query(collection(db, "groupClassInstructors"), orderBy('name')) : null, [db]));
    const { data: times, isLoading: l3 } = useCollection<GroupClassTime>(useMemoFirebase(() => db ? query(collection(db, "groupClassTimes"), orderBy('name')) : null, [db]));
    const { data: attendances, isLoading: l4 } = useCollection<GroupClassAttendance>(useMemoFirebase(() => db ? query(collection(db, "groupClassAttendances"), orderBy('created_at', 'desc')) : null, [db]));

    const { toast } = useToast();

    const handleDelete = (collectionName: string, id: string) => {
        setItemToDelete({ collection: collectionName, id });
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete || !db) return;
        startTransition(async () => {
            try {
                await deleteDoc(doc(db, itemToDelete.collection, itemToDelete.id));
                toast({ title: 'ลบสำเร็จ' });
                setDeleteConfirmOpen(false);
                setItemToDelete(null);
            } catch (error) {
                toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถลบข้อมูลได้', variant: 'destructive' });
            }
        });
    };

    return (
        <>
            <header className="bg-slate-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Users2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold">RCF Group Class Attendance Tracker</h1>
                            <p className="text-slate-300 text-sm md:text-base">Track and analyze group class attendance.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setSettingsOpen(true)} variant="outline" size="icon" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                            <Settings className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="sticky top-0 z-30 bg-white shadow-md">
                    <div className="container mx-auto">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="signin">ลงชื่อเข้าคลาส</TabsTrigger>
                            <TabsTrigger value="history">ประวัติ</TabsTrigger>
                            <TabsTrigger value="monthly">สถิติรายเดือน</TabsTrigger>
                            <TabsTrigger value="yearly">สถิติรายปี</TabsTrigger>
                            <TabsTrigger value="analysis">วิเคราะห์</TabsTrigger>
                        </TabsList>
                    </div>
                </div>
                
                <main className="container mx-auto py-8">
                        <TabsContent value="signin">
                            <SigninTab classes={classes || []} instructors={instructors || []} times={times || []} />
                        </TabsContent>
                        <TabsContent value="history">
                            <HistoryTab 
                                attendances={attendances || []} 
                                classes={classes || []} 
                                instructors={instructors || []}
                                onDelete={handleDelete} 
                            />
                        </TabsContent>
                         <TabsContent value="monthly">
                            <MonthlyStatsTab attendances={attendances || []} />
                        </TabsContent>
                        <TabsContent value="yearly">
                             <YearlyStatsTab attendances={attendances || []} />
                        </TabsContent>
                         <TabsContent value="analysis">
                            <AnalysisTab attendances={attendances || []} />
                        </TabsContent>
                </main>
            </Tabs>
            
            <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} classes={classes || []} instructors={instructors || []} times={times || []} onDelete={handleDelete} />

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการลบ?</AlertDialogTitle>
                        <AlertDialogDescription>การดำเนินการนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} disabled={isPending} className="bg-red-600 hover:bg-red-700">
                             {isPending ? <Loader2 className="animate-spin"/> : 'ลบ'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function SigninTab({ classes, instructors, times }: { classes: GroupClass[], instructors: GroupClassInstructor[], times: GroupClassTime[] }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<GroupClass | null>(null);

    const handleClassClick = (cls: GroupClass) => {
        setSelectedClass(cls);
        setDialogOpen(true);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FilePenLine className="w-6 h-6 text-primary" />
                        ลงชื่อเข้าใช้คลาส
                    </CardTitle>
                    <CardDescription>เลือกคลาสเพื่อบันทึกข้อมูลการเข้าใช้และลงลายมือชื่อ</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {classes.length > 0 ? classes.map(cls => (
                            <Button key={cls.id} variant="outline" className="h-20 justify-start p-4 text-left flex-col items-start gap-1" onClick={() => handleClassClick(cls)}>
                                <Dumbbell className="w-5 h-5 text-muted-foreground" />
                                <span className="font-semibold">{cls.name}</span>
                            </Button>
                        )) : (
                            <p className="text-muted-foreground col-span-full text-center">ไม่มีคลาสในระบบ กรุณาเพิ่มคลาสในหน้าตั้งค่า</p>
                        )}
                    </div>
                </CardContent>
            </Card>
            {selectedClass && (
                <ClassSigningDialog 
                    open={dialogOpen} 
                    onOpenChange={setDialogOpen} 
                    cls={selectedClass} 
                    instructors={instructors}
                    times={times}
                />
            )}
        </>
    )
}

function HistoryTab({ attendances, classes, instructors, onDelete }: { attendances: GroupClassAttendance[], classes: GroupClass[], instructors: GroupClassInstructor[], onDelete: (collection: string, id: string) => void }) {
    const [monthFilter, setMonthFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

    useEffect(() => {
        setMonthFilter(new Date().toISOString().slice(0, 7));
    }, []);

    const filteredHistory = useMemo(() => {
        return attendances.filter(r => {
            const [year, month] = monthFilter ? monthFilter.split('-') : ['', ''];
            const targetMonthYear = monthFilter ? `${month}/${year}` : '';

            const monthMatch = !targetMonthYear || r.month_year === targetMonthYear;
            const classMatch = classFilter === 'all' || r.class_name === classFilter;
            return monthMatch && classMatch;
        });
    }, [attendances, monthFilter, classFilter]);
    
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <History className="w-6 h-6 text-primary"/>
                        ประวัติการบันทึก
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-auto" />
                        <Select value={classFilter} onValueChange={setClassFilter}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="ทุกคลาส" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทุกคลาส</SelectItem>
                                {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={() => setPdfDialogOpen(true)}><FileText className="mr-2 h-4 w-4"/>Generate PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-96">
                <Accordion type="single" collapsible className="w-full space-y-2">
                    {filteredHistory.length > 0 ? filteredHistory.map(r => (
                         <AccordionItem value={r.id} key={r.id} className="border rounded-lg">
                            <AccordionTrigger className="p-4 hover:no-underline w-full text-left">
                                <div>
                                    <div className="font-medium">{r.class_name} - {r.attendance} คน</div>
                                    <div className="text-sm text-gray-500">{r.date} ({r.day_of_week}) • {r.time} • {r.instructor}</div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2">ลายมือชื่อครูผู้สอน</h4>
                                        {r.instructorSignature ? <img src={r.instructorSignature} alt="Instructor Signature" className="border rounded-md bg-white"/> : <p className="text-xs text-muted-foreground">ไม่มีลายมือชื่อ</p>}
                                        <p className="text-xs text-center mt-1">{r.instructor}</p>
                                    </div>
                                     <div>
                                        <h4 className="font-semibold text-sm mb-2">ลายมือชื่อพนักงาน</h4>
                                        {r.staffSignature ? <img src={r.staffSignature} alt="Staff Signature" className="border rounded-md bg-white"/> : <p className="text-xs text-muted-foreground">ไม่มีลายมือชื่อ</p>}
                                        <p className="text-xs text-center mt-1">{r.staffName}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete('groupClassAttendances', r.id)}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Record
                                    </Button>
                                </div>
                            </AccordionContent>
                         </AccordionItem>
                    )) : <p className="text-center text-gray-500 py-8">ไม่พบข้อมูล</p>}
                </Accordion>
                </ScrollArea>
                 <PDFExportDialog 
                    open={pdfDialogOpen} 
                    onOpenChange={setPdfDialogOpen}
                    attendances={attendances}
                    instructors={instructors}
                    classes={classes}
                    defaultFilters={{month: monthFilter, class: classFilter}}
                />
            </CardContent>
        </Card>
    );
}

function MonthlyStatsTab({ attendances }: { attendances: GroupClassAttendance[] }) {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

    const stats = useMemo(() => {
        if (!month) return { total: 0, count: 0, avg: 0, topClass: '-', rankings: [], instructorComp: [] };

        const [year, monthNum] = month.split('-');
        const targetMonthYear = `${monthNum}/${year}`;
        const records = attendances.filter(r => r.month_year === targetMonthYear);

        const total = records.reduce((sum, r) => sum + r.attendance, 0);
        const count = records.length;
        const avg = count ? (total / count) : 0;
        
        const classStats = records.reduce((acc, r) => {
            if (!acc[r.class_name]) acc[r.class_name] = { total: 0, count: 0 };
            acc[r.class_name].total += r.attendance;
            acc[r.class_name].count++;
            return acc;
        }, {} as Record<string, { total: number, count: number }>);

        const rankings = Object.entries(classStats)
            .map(([name, data]) => ({ name, ...data, avg: (data.total / data.count) }))
            .sort((a, b) => b.total - a.total);

        const instructorStats = records.reduce((acc, r) => {
            const key = `${r.class_name}|${r.instructor}`;
            if (!acc[key]) acc[key] = { class: r.class_name, instructor: r.instructor, total: 0, count: 0 };
            acc[key].total += r.attendance;
            acc[key].count++;
            return acc;
        }, {} as Record<string, { class: string; instructor: string; total: number; count: number }>);
        
        const instructorComp = Object.values(instructorStats)
            .map(s => ({ ...s, avg: s.total / s.count }))
            .sort((a, b) => b.avg - a.avg);

        return {
            total,
            count,
            avg,
            topClass: rankings[0]?.name || '-',
            rankings,
            instructorComp
        };
    }, [attendances, month]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <CardTitle className="flex items-center gap-2">
                             <BarChart3 className="w-6 h-6 text-primary" />
                            สถิติรายเดือน
                        </CardTitle>
                        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full sm:w-auto" />
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                         <StatCard title="ผู้ใช้ทั้งหมด" value={stats.total.toLocaleString()} color="emerald" />
                         <StatCard title="จำนวนคลาส" value={stats.count.toLocaleString()} color="blue" />
                         <StatCard title="เฉลี่ย/ครั้ง" value={stats.avg.toFixed(1)} color="amber" />
                         <StatCard title="คลาสยอดนิยม" value={stats.topClass} color="rose" isText />
                    </div>
                     <div className="space-y-3">
                         {stats.rankings.length ? stats.rankings.map((r, i) => (
                             <div key={r.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                               <div className="flex items-center gap-3">
                                 <span className={`w-8 h-8 flex items-center justify-center ${i < 3 ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-600'} rounded-full font-bold text-sm`}>{i + 1}</span>
                                 <div>
                                   <p className="font-medium text-gray-800">{r.name}</p>
                                   <p className="text-xs text-gray-500">{r.count} ครั้ง • เฉลี่ย {r.avg.toFixed(1)} คน/ครั้ง</p>
                                 </div>
                               </div>
                               <span className="text-lg font-bold text-emerald-600">{r.total}</span>
                             </div>
                         )) : <p className="text-center text-gray-500 py-4">เลือกเดือนเพื่อดูสถิติ</p>}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-md">
                        <UserSquare className="w-5 h-5 text-indigo-600"/>
                        เปรียบเทียบครูผู้สอน
                    </CardTitle>
                </CardHeader>
                 <CardContent>
                     <div className="space-y-3">
                        {stats.instructorComp.length ? stats.instructorComp.map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-800">{s.instructor}</p>
                                    <p className="text-xs text-gray-500">{s.class} • {s.count} ครั้ง</p>
                                </div>
                                <span className="text-lg font-bold text-indigo-600">{s.avg.toFixed(1)} <span className="text-xs font-normal">คน/ครั้ง</span></span>
                            </div>
                        )) : <p className="text-center text-gray-500 py-4">เลือกเดือนเพื่อดูข้อมูล</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function YearlyStatsTab({ attendances }: { attendances: GroupClassAttendance[] }) {
    const years = useMemo(() => [...new Set(attendances.map(r => r.month_year.split('/')[1]))].sort((a, b) => parseInt(b) - parseInt(a)), [attendances]);
    const [year, setYear] = useState('');

    useEffect(() => {
        if(years.length > 0 && !year) {
            setYear(years[0]);
        }
    }, [years, year]);

    const stats = useMemo(() => {
        if (!year) return { total: 0, count: 0, trend: '-', top5: [], bottom5: [], topInstructors: [] };
        
        const records = attendances.filter(r => r.month_year.endsWith(`/${year}`));
        const total = records.reduce((sum, r) => sum + r.attendance, 0);
        
        const monthlyTotals = records.reduce((acc, r) => {
            const month = r.month_year.split('/')[0];
            acc[month] = (acc[month] || 0) + r.attendance;
            return acc;
        }, {} as Record<string, number>);
        
        const months = Object.keys(monthlyTotals).sort();
        let trend = '-';
        if (months.length >= 2) {
            const firstHalfAvg = months.slice(0, Math.ceil(months.length / 2)).reduce((sum, m) => sum + monthlyTotals[m], 0) / Math.ceil(months.length / 2);
            const secondHalfAvg = months.slice(Math.ceil(months.length / 2)).reduce((sum, m) => sum + monthlyTotals[m], 0) / (months.length - Math.ceil(months.length / 2));
            if (secondHalfAvg > firstHalfAvg * 1.1) trend = '📈 เพิ่มขึ้น';
            else if (secondHalfAvg < firstHalfAvg * 0.9) trend = '📉 ลดลง';
            else trend = '➡️ คงที่';
        }

        const classStats = records.reduce((acc, r) => {
            if (!acc[r.class_name]) acc[r.class_name] = { total: 0, count: 0 };
            acc[r.class_name].total += r.attendance;
            acc[r.class_name].count++;
            return acc;
        }, {} as Record<string, { total: number, count: number }>);

        const rankings = Object.entries(classStats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
        
        const instructorStats = records.reduce((acc, r) => {
            if (!acc[r.instructor]) acc[r.instructor] = { total: 0, count: 0 };
            acc[r.instructor].total += r.attendance;
            acc[r.instructor].count++;
            return acc;
        }, {} as Record<string, { total: number; count: number; }>);
        
        const topInstructors = Object.entries(instructorStats)
            .map(([name, data]) => ({ name, avg: data.total / data.count }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 5);

        return { total, count: records.length, trend, top5: rankings.slice(0, 5), bottom5: rankings.slice(-5).reverse(), topInstructors };

    }, [attendances, year]);
    
    return (
        <Card>
            <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-primary" />
                        สถิติรายปี
                    </CardTitle>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="เลือกปี" /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <StatCard title="ผู้ใช้ทั้งปี" value={stats.total.toLocaleString()} color="emerald" />
                    <StatCard title="คลาสทั้งหมด" value={stats.count.toLocaleString()} color="blue" />
                    <StatCard title="แนวโน้ม" value={stats.trend} color="amber" isText />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> Top 5 คลาสยอดนิยม</h3>
                        <div className="space-y-2">
                            {stats.top5.length ? stats.top5.map((r, i) => (
                                <div key={r.name} className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                                    <p className="text-sm">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} {r.name}</p>
                                    <p className="font-semibold text-emerald-600">{r.total}</p>
                                </div>
                            )) : <p className="text-gray-500 text-sm">เลือกปีเพื่อดูข้อมูล</p>}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingDown className="w-5 h-5 text-rose-500" /> Bottom 5 คลาสผู้ใช้น้อย</h3>
                        <div className="space-y-2">
                             {stats.bottom5.length ? stats.bottom5.map(r => (
                                <div key={r.name} className="flex items-center justify-between p-2 bg-rose-50 rounded-lg">
                                    <p className="text-sm">{r.name}</p>
                                    <p className="font-semibold text-rose-600">{r.total}</p>
                                </div>
                            )) : <p className="text-gray-500 text-sm">เลือกปีเพื่อดูข้อมูล</p>}
                        </div>
                    </div>
                </div>
                 <div className="mt-6">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Star className="w-5 h-5 text-amber-500" /> ครูผู้สอนค่าเฉลี่ยสูงสุด</h3>
                    <div className="space-y-2">
                        {stats.topInstructors.length ? stats.topInstructors.map(i => (
                             <div key={i.name} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                                <p className="text-sm">{i.name}</p>
                                <p className="font-semibold text-amber-600">{i.avg.toFixed(1)} <span className="text-xs font-normal">คน/ครั้ง</span></p>
                             </div>
                        )) : <p className="text-gray-500 text-sm">เลือกปีเพื่อดูข้อมูล</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AnalysisTab({ attendances }: { attendances: GroupClassAttendance[] }) {
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [threshold, setThreshold] = useState(5);
    const [results, setResults] = useState<any>(null);
    const { toast } = useToast();

    const runAnalysis = () => {
        if (!month) {
            toast({ title: 'กรุณาเลือกเดือน', variant: 'destructive' });
            return;
        }
        const [year, monthNum] = month.split('-');
        const targetMonthYear = `${monthNum}/${year}`;
        const records = attendances.filter(r => r.month_year === targetMonthYear);

        if (records.length === 0) {
            setResults({ empty: true });
            return;
        }
        const classStats = records.reduce((acc, r) => {
            if (!acc[r.class_name]) acc[r.class_name] = { total: 0, count: 0, instructors: {}, times: {} };
            acc[r.class_name].total += r.attendance;
            acc[r.class_name].count++;
            
            const inst = acc[r.class_name].instructors;
            if (!inst[r.instructor]) inst[r.instructor] = { total: 0, count: 0 };
            inst[r.instructor].total += r.attendance;
            inst[r.instructor].count++;

            return acc;
        }, {} as Record<string, { total: number, count: number, instructors: Record<string, {total: number, count:number}>, times: any }>);

        const recommendations = Object.entries(classStats)
            .map(([name, data]) => ({ name, avg: data.total / data.count, ...data }))
            .filter(c => c.avg < threshold);

        setResults({ recommendations, month: targetMonthYear, threshold });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="w-6 h-6 text-primary" />
                        วิเคราะห์และข้อเสนอแนะ
                    </CardTitle>
                    <div className="flex gap-2 items-center">
                        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
                        <Input type="number" value={threshold} onChange={e => setThreshold(parseInt(e.target.value))} min="1" className="w-20" placeholder="เกณฑ์" />
                        <Button onClick={runAnalysis}>วิเคราะห์</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {results ? (
                    results.empty ? <p className="text-center text-gray-500 py-8">ไม่พบข้อมูลในเดือนที่เลือก</p> :
                    <div className="space-y-4">
                        <div className="text-sm text-gray-600">📊 วิเคราะห์ข้อมูลเดือน {results.month} • เกณฑ์ขั้นต่ำ: {results.threshold} คน/ครั้ง</div>
                        <div className="p-4 bg-red-50 rounded-xl">
                            <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2"><Ban className="w-5 h-5" /> คลาสที่ควรพิจารณา (เฉลี่ยต่ำกว่าเกณฑ์)</h3>
                             {results.recommendations.length ? results.recommendations.map((r: any) => (
                                 <div key={r.name} className="p-3 bg-white rounded-lg border-l-4 border-red-400 mb-2">
                                     <div className="flex justify-between items-center">
                                         <p className="font-semibold">{r.name}</p>
                                         <p className="font-bold text-red-600">{r.avg.toFixed(1)} คน/ครั้ง</p>
                                     </div>
                                     <p className="text-xs text-gray-500 mt-1">{r.count} ครั้งในเดือนนี้</p>
                                 </div>
                             )) : <p className="text-gray-500">✅ ไม่มีคลาสที่ต่ำกว่าเกณฑ์</p>}
                        </div>
                    </div>
                ) : <p className="text-center text-gray-500 py-8">กรอกเดือนและเกณฑ์ขั้นต่ำ แล้วกดวิเคราะห์</p>}
            </CardContent>
        </Card>
    );
}

const StatCard = ({ title, value, color, isText = false }: { title: string, value: string | number, color: string, isText?: boolean }) => {
    const colors = {
        emerald: { border: 'border-emerald-100', text: 'text-emerald-600' },
        blue: { border: 'border-blue-100', text: 'text-blue-600' },
        amber: { border: 'border-amber-100', text: 'text-amber-600' },
        rose: { border: 'border-rose-100', text: 'text-rose-600' },
    }
    const style = colors[color as keyof typeof colors] || colors.emerald;
    
    return (
        <div className={`bg-white p-4 rounded-xl border ${style.border}`}>
            <p className="text-xs text-gray-500 mb-1">{title}</p>
            <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold ${style.text} truncate`}>{value}</p>
        </div>
    )
}

function SettingsDialog({ open, onOpenChange, classes, instructors, times, onDelete }: { open: boolean, onOpenChange: (open: boolean) => void, classes: GroupClass[], instructors: GroupClassInstructor[], times: GroupClassTime[], onDelete: (collection: string, id: string) => void }) {
    const { firestore: db } = useFirebase();
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [tab, setTab] = useState('classes');

    const handleAddItem = async (type: string, inputId: string, collectionName: string) => {
        if (!db) return;
        const input = document.getElementById(inputId) as HTMLInputElement;
        const name = input.value.trim();
        if (!name) return;

        startTransition(async () => {
             try {
                await addDoc(collection(db, collectionName), { name, created_at: serverTimestamp() });
                toast({ title: 'เพิ่มสำเร็จ' });
                input.value = '';
            } catch (error) {
                toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
            }
        });
    }

    return (
         <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center"><Settings className="w-5 h-5 mr-2"/> ตั้งค่าระบบ</DialogTitle>
                </DialogHeader>
                 <Tabs value={tab} onValueChange={setTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="classes"><Dumbbell className="w-4 h-4 mr-2" />คลาส</TabsTrigger>
                        <TabsTrigger value="instructors"><UserSquare className="w-4 h-4 mr-2" />ครูผู้สอน</TabsTrigger>
                        <TabsTrigger value="times"><Clock className="w-4 h-4 mr-2" />เวลา</TabsTrigger>
                    </TabsList>
                    <TabsContent value="classes">
                        <SettingsList title="คลาส" items={classes} onAdd={() => handleAddItem('class', 'new-class', 'groupClasses')} onDelete={(id) => onDelete('groupClasses', id)} inputId="new-class" placeholder="ชื่อคลาสใหม่" />
                    </TabsContent>
                    <TabsContent value="instructors">
                        <SettingsList title="ครูผู้สอน" items={instructors} onAdd={() => handleAddItem('instructor', 'new-instructor', 'groupClassInstructors')} onDelete={(id) => onDelete('groupClassInstructors', id)} inputId="new-instructor" placeholder="ชื่อครูผู้สอนใหม่" />
                    </TabsContent>
                     <TabsContent value="times">
                        <SettingsList title="เวลา" items={times} onAdd={() => handleAddItem('time', 'new-time', 'groupClassTimes')} onDelete={(id) => onDelete('groupClassTimes', id)} inputId="new-time" inputType="time" />
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">ปิด</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SettingsList({ title, items, onAdd, onDelete, inputId, placeholder, inputType = 'text' }: any) {
    return (
        <div className="py-4">
            <div className="flex gap-2 mb-4">
                <Input type={inputType} id={inputId} placeholder={placeholder} />
                <Button onClick={onAdd}><Plus className="w-4 h-4 mr-2" />เพิ่ม</Button>
            </div>
            <ScrollArea className="h-64">
                <div className="space-y-2">
                    {items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">{item.name}</span>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}

const signinSchema = z.object({
    instructor: z.string().min(1, "กรุณาเลือกครูผู้สอน"),
    time: z.string().min(1, "กรุณาเลือกเวลา"),
    attendance: z.coerce.number().min(0, "จำนวนต้องไม่ต่ำกว่า 0"),
    staffName: z.string().min(1, "กรุณากรอกชื่อพนักงาน"),
    instructorSignature: z.string().min(1, "ต้องมีลายเซ็นครูผู้สอน"),
    staffSignature: z.string().min(1, "ต้องมีลายเซ็นพนักงาน"),
});


function ClassSigningDialog({ open, onOpenChange, cls, instructors, times }: { open: boolean, onOpenChange: (open: boolean) => void, cls: GroupClass, instructors: GroupClassInstructor[], times: GroupClassTime[] }) {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const { control, handleSubmit, register, formState: { errors } } = useForm<z.infer<typeof signinSchema>>({
        resolver: zodResolver(signinSchema),
        defaultValues: { instructor: '', time: '', attendance: 0, staffName: '', instructorSignature: '', staffSignature: '' }
    });

    const onSubmit = (data: z.infer<typeof signinSchema>) => {
        if (!db) return;

        startTransition(async () => {
            const dateObj = new Date();
            const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
            const dayOfWeek = days[dateObj.getDay()];
            const monthYear = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
            const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

            try {
                await addDoc(collection(db, "groupClassAttendances"), {
                    ...data,
                    class_name: cls.name,
                    date: formattedDate,
                    month_year: monthYear,
                    day_of_week: dayOfWeek,
                    created_at: serverTimestamp()
                });
                toast({ title: 'บันทึกสำเร็จ' });
                onOpenChange(false);
            } catch (error) {
                toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกข้อมูลได้', variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>ลงชื่อเข้าคลาส: {cls.name}</DialogTitle>
                    <DialogDescription>วันที่: {new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                             <div>
                                <Label>ครูผู้สอน</Label>
                                <Controller name="instructor" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="เลือกครู" /></SelectTrigger>
                                        <SelectContent><ScrollArea className="h-48">{instructors.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</ScrollArea></SelectContent>
                                    </Select>
                                )}/>
                                {errors.instructor && <p className="text-xs text-destructive mt-1">{errors.instructor.message}</p>}
                            </div>
                             <div>
                                <Label>เวลา</Label>
                                <Controller name="time" control={control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger><SelectValue placeholder="เลือกเวลา" /></SelectTrigger>
                                        <SelectContent>{times.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}/>
                                {errors.time && <p className="text-xs text-destructive mt-1">{errors.time.message}</p>}
                            </div>
                            <div>
                                <Label>จำนวนผู้เข้าใช้ (คน)</Label>
                                <Input type="number" {...register('attendance')} min="0" placeholder="0" />
                                {errors.attendance && <p className="text-xs text-destructive mt-1">{errors.attendance.message}</p>}
                            </div>
                             <div>
                                <Label>ชื่อพนักงาน</Label>
                                <Input {...register('staffName')} placeholder="ชื่อพนักงานผู้ตรวจ" />
                                {errors.staffName && <p className="text-xs text-destructive mt-1">{errors.staffName.message}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Controller name="instructorSignature" control={control} render={({ field }) => <SignaturePad label="ลายมือชื่อครูผู้สอน" onSignatureChange={field.onChange} />} />
                            <Controller name="staffSignature" control={control} render={({ field }) => <SignaturePad label="ลายมือชื่อพนักงาน" onSignatureChange={field.onChange} />} />
                        </div>
                         {errors.instructorSignature && <p className="text-xs text-center text-destructive">{errors.instructorSignature.message}</p>}
                         {errors.staffSignature && <p className="text-xs text-center text-destructive">{errors.staffSignature.message}</p>}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">ยกเลิก</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            ยืนยันและบันทึก
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PDFExportDialog({ open, onOpenChange, attendances, instructors, classes, defaultFilters }: { open: boolean, onOpenChange: (open: boolean) => void, attendances: GroupClassAttendance[], instructors: GroupClassInstructor[], classes: GroupClass[], defaultFilters: { month: string, class: string } }) {
    const { toast } = useToast();
    const [monthFilter, setMonthFilter] = useState(defaultFilters.month);
    const [classFilter, setClassFilter] = useState(defaultFilters.class);
    const [instructorFilter, setInstructorFilter] = useState('all');

    useEffect(() => {
        setMonthFilter(defaultFilters.month);
        setClassFilter(defaultFilters.class);
    }, [defaultFilters]);

    const generatePDF = () => {
        const filtered = attendances.filter(r => {
            const [year, month] = monthFilter ? monthFilter.split('-') : ['', ''];
            const targetMonthYear = monthFilter ? `${month}/${year}` : '';

            const monthMatch = !targetMonthYear || r.month_year === targetMonthYear;
            const classMatch = classFilter === 'all' || r.class_name === classFilter;
            const instructorMatch = instructorFilter === 'all' || r.instructor === instructorFilter;
            return monthMatch && classMatch && instructorMatch;
        }).sort((a,b) => {
            const dateA = a.date.split('/').reverse().join('-');
            const dateB = b.date.split('/').reverse().join('-');
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

        if (filtered.length === 0) {
            toast({ title: "ไม่พบข้อมูล", description: "ไม่พบข้อมูลการเข้าคลาสตามเงื่อนไขที่เลือก", variant: "destructive" });
            return;
        }

        const totalAttendance = filtered.reduce((sum, r) => sum + r.attendance, 0);
        const classCount = filtered.length;
        const averageAttendance = classCount > 0 ? Math.round(totalAttendance / classCount) : 0;
        const generationDate = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });


        let htmlContent = `
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><title>Group Class Report</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
                th { background-color: #f2f2f2; }
                .header { text-align: center; margin-bottom: 20px; }
                .header h1 { margin-bottom: 5px; font-size: 18px; }
                .header .summary { font-size: 12px; margin-bottom: 5px; }
                .header .generation-date { font-size: 10px; color: #888; }
                .signature { max-height: 40px; width: auto; vertical-align: middle; }
            </style>
            </head><body>
            <div class="header">
                <h1>Group Class Attendance Report</h1>
                <p class="summary">Total Attendance: ${totalAttendance} | Classes: ${classCount} | Average: ${averageAttendance} per class</p>
                <p class="generation-date">Generated on: ${generationDate}</p>
            </div>
            <table><thead><tr>
                <th>Date</th><th>Time</th><th>Class</th><th>Instructor</th><th>Attendees</th><th>Staff</th><th>Instructor Sign</th><th>Staff Sign</th>
            </tr></thead><tbody>
            ${filtered.map(r => `
                <tr>
                    <td>${r.date}</td><td>${r.time}</td><td>${r.class_name}</td><td>${r.instructor}</td><td>${r.attendance}</td><td>${r.staffName || ''}</td>
                    <td>${r.instructorSignature ? `<img src="${r.instructorSignature}" class="signature"/>` : ''}</td>
                    <td>${r.staffSignature ? `<img src="${r.staffSignature}" class="signature"/>` : ''}</td>
                </tr>
            `).join('')}
            </tbody></table>
            </body></html>
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
            printWindow.onafterprint = () => printWindow.close();
        }, 300);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Generate Class Report PDF</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>Filter by Month</Label>
                        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
                    </div>
                    <div>
                        <Label>Filter by Class</Label>
                         <Select value={classFilter} onValueChange={setClassFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Classes</SelectItem>
                                {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label>Filter by Instructor</Label>
                         <Select value={instructorFilter} onValueChange={setInstructorFilter}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Instructors</SelectItem>
                                {instructors.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={generatePDF}>Generate PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function GroupClassTrackerPage() {
    return (
        <FirebaseClientProvider>
            <GroupClassTrackerPageContent />
        </FirebaseClientProvider>
    );
}
