"use client";

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { collection, addDoc, doc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

import { FirebaseClientProvider, useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { GroupClass, GroupClassInstructor, GroupClassTime, GroupClassAttendance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Settings, Trash2, CalendarCheck, BarChart3, TrendingUp, BarChart, X, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

function GroupClassTrackerPageContent() {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [activeTab, setActiveTab] = useState("record");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState("classes");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ collection: string, id: string } | null>(null);

    const { data: classes, isLoading: l1 } = useCollection<GroupClass>(useMemoFirebase(() => db ? query(collection(db, "groupClasses"), orderBy('name')) : null, [db]));
    const { data: instructors, isLoading: l2 } = useCollection<GroupClassInstructor>(useMemoFirebase(() => db ? query(collection(db, "groupClassInstructors"), orderBy('name')) : null, [db]));
    const { data: times, isLoading: l3 } = useCollection<GroupClassTime>(useMemoFirebase(() => db ? query(collection(db, "groupClassTimes"), orderBy('name')) : null, [db]));
    const { data: attendances, isLoading: l4 } = useCollection<GroupClassAttendance>(useMemoFirebase(() => db ? query(collection(db, "groupClassAttendances"), orderBy('created_at', 'desc')) : null, [db]));

    const loading = l1 || l2 || l3 || l4;

    const [date, setDate] = useState('');
    useEffect(() => {
        setDate(new Date().toISOString().split('T')[0]);
    }, []);

    const handleSaveAttendance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db) return;
        const formData = new FormData(e.currentTarget as HTMLFormElement);

        const dateVal = formData.get('date') as string;
        const timeVal = formData.get('time') as string;
        const classVal = formData.get('class_name') as string;
        const instructorVal = formData.get('instructor') as string;
        const attendanceVal = parseInt(formData.get('attendance') as string);

        if (!dateVal || !timeVal || !classVal || !instructorVal || isNaN(attendanceVal)) {
            toast({ title: 'ข้อมูลไม่ครบถ้วน', description: 'กรุณากรอกข้อมูลให้ครบทุกช่อง', variant: 'destructive' });
            return;
        }
        
        const dateObj = new Date(dateVal);
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const dayOfWeek = days[dateObj.getDay()];
        const monthYear = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
        const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

        startTransition(async () => {
             try {
                await addDoc(collection(db, "groupClassAttendances"), {
                    type: 'attendance',
                    date: formattedDate,
                    month_year: monthYear,
                    day_of_week: dayOfWeek,
                    time: timeVal,
                    class_name: classVal,
                    instructor: instructorVal,
                    attendance: attendanceVal,
                    created_at: serverTimestamp()
                });
                toast({ title: 'บันทึกสำเร็จ' });
                (e.target as HTMLFormElement).reset();
                setDate(new Date().toISOString().split('T')[0]);

            } catch (error) {
                toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกข้อมูลได้', variant: 'destructive' });
            }
        });
    };

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
        <div className="h-full flex flex-col overflow-hidden">
            <header className="bg-gradient-to-r from-emerald-600 to-green-500 text-white p-4 shadow-lg flex-shrink-0">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <CalendarCheck className="w-7 h-7"/>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Group Class Attendance Tracker</h1>
                                <p className="text-emerald-100 text-sm">ระบบบันทึกผู้เข้าใช้คลาสฟิตเนส</p>
                            </div>
                        </div>
                        <Button onClick={() => setSettingsOpen(true)} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                            <Settings className="w-6 h-6" />
                        </Button>
                    </div>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white border-b shadow-sm rounded-none">
                    <TabsTrigger value="record">📝 บันทึกข้อมูล</TabsTrigger>
                    <TabsTrigger value="history">📋 ประวัติ</TabsTrigger>
                    <TabsTrigger value="monthly">📊 สถิติรายเดือน</TabsTrigger>
                    <TabsTrigger value="yearly">📈 สถิติรายปี</TabsTrigger>
                    <TabsTrigger value="analysis">💡 วิเคราะห์</TabsTrigger>
                </TabsList>
                
                <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <div className="max-w-7xl mx-auto">
                        <TabsContent value="record">
                             <Card className="shadow-lg">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <span className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">📝</span>
                                        บันทึกข้อมูลการเข้าใช้คลาส
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSaveAttendance} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                                                <Input type="date" name="date" value={date} onChange={e => setDate(e.target.value)} required />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">เวลา</label>
                                                <Select name="time" required>
                                                    <SelectTrigger><SelectValue placeholder="เลือกเวลา" /></SelectTrigger>
                                                    <SelectContent>
                                                        {(times || []).map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อคลาส</label>
                                                 <Select name="class_name" required>
                                                    <SelectTrigger><SelectValue placeholder="เลือกคลาส" /></SelectTrigger>
                                                    <SelectContent>
                                                         {(classes || []).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">ครูผู้สอน</label>
                                                <Select name="instructor" required>
                                                    <SelectTrigger><SelectValue placeholder="เลือกครูผู้สอน" /></SelectTrigger>
                                                    <SelectContent>
                                                         {(instructors || []).map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนผู้เข้าใช้ (คน)</label>
                                            <Input type="number" name="attendance" min="0" placeholder="0" required />
                                        </div>
                                        <Button type="submit" disabled={isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                                            {isPending ? <Loader2 className="animate-spin" /> : '💾 บันทึกข้อมูล'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="history">
                            <HistoryTab attendances={attendances || []} classes={classes || []} onDelete={handleDelete} />
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
                    </div>
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
        </div>
    );
}


function HistoryTab({ attendances, classes, onDelete }: { attendances: GroupClassAttendance[], classes: GroupClass[], onDelete: (collection: string, id: string) => void }) {
    const [monthFilter, setMonthFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');

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
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">📋</span>
                        ประวัติการบันทึก
                    </CardTitle>
                    <div className="flex gap-2">
                        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
                        <Select value={classFilter} onValueChange={setClassFilter}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="ทุกคลาส" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทุกคลาส</SelectItem>
                                {classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-96">
                <div className="space-y-3">
                    {filteredHistory.length > 0 ? filteredHistory.map(r => (
                         <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100">
                             <div>
                                 <div className="font-medium">{r.class_name} - {r.attendance} คน</div>
                                 <div className="text-sm text-gray-500">{r.date} ({r.day_of_week}) • {r.time} • {r.instructor}</div>
                             </div>
                             <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-100" onClick={() => onDelete('groupClassAttendances', r.id)}>
                                 <Trash2 className="w-4 h-4" />
                             </Button>
                         </div>
                    )) : <p className="text-center text-gray-500 py-8">ไม่พบข้อมูล</p>}
                </div>
                </ScrollArea>
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
            <Card className="shadow-lg">
                <CardHeader>
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <CardTitle className="flex items-center gap-2">
                             <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600"><BarChart3 /></span>
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
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-md">
                        <span className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-sm">👨‍🏫</span>
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
        
        // Trend
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

        // Rankings
        const classStats = records.reduce((acc, r) => {
            if (!acc[r.class_name]) acc[r.class_name] = { total: 0, count: 0 };
            acc[r.class_name].total += r.attendance;
            acc[r.class_name].count++;
            return acc;
        }, {} as Record<string, { total: number, count: number }>);

        const rankings = Object.entries(classStats).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
        
        // Top Instructors
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
        <Card className="shadow-lg">
            <CardHeader>
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600"><TrendingUp /></span>
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
                        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">🏆 Top 5 คลาสยอดนิยม</h3>
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
                        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">📉 Bottom 5 คลาสผู้ใช้น้อย</h3>
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
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">⭐ ครูผู้สอนค่าเฉลี่ยสูงสุด</h3>
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
        // This is a simplified analysis, a more robust version would be needed for production
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
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600"><Info /></span>
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
                            <h3 className="font-semibold text-red-800 mb-3">🚫 คลาสที่ควรพิจารณา (เฉลี่ยต่ำกว่าเกณฑ์)</h3>
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
                    <DialogTitle>⚙️ ตั้งค่าระบบ</DialogTitle>
                </DialogHeader>
                 <Tabs value={tab} onValueChange={setTab} className="w-full">
                    <TabsList>
                        <TabsTrigger value="classes">🏋️ คลาส</TabsTrigger>
                        <TabsTrigger value="instructors">👨‍🏫 ครูผู้สอน</TabsTrigger>
                        <TabsTrigger value="times">🕐 เวลา</TabsTrigger>
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

export default function GroupClassTrackerPage() {
    return (
        <FirebaseClientProvider>
            <GroupClassTrackerPageContent />
        </FirebaseClientProvider>
    );
}
