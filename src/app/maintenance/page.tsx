"use client";

import { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    orderBy, 
    query, 
    doc, 
    updateDoc, 
    deleteDoc,
    serverTimestamp,
    getDocs,
    writeBatch,
    where,
    limit,
    getDoc,
} from 'firebase/firestore';

import { firebaseConfig } from '@/firebase/config';
import type { MaintenanceReport, MaintenanceCategory } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Settings, X, FileText, AlertTriangle, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const maintenanceCollectionRef = collection(db, "MaintenanceReport1");
const categoriesCollectionRef = collection(db, "MaintenanceCategories");

const categoryColors: { [key: string]: { bg: string; text: string; hex: string } } = {
    'cardio': { bg: 'bg-red-100', text: 'text-red-800', hex: '#FEE2E2' },
    'strength': { bg: 'bg-blue-100', text: 'text-blue-800', hex: '#DBEAFE' },
    'electrical': { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#FEF3C7' },
    'plumbing': { bg: 'bg-green-100', text: 'text-green-800', hex: '#D1FAE5' },
    'aircon': { bg: 'bg-purple-100', text: 'text-purple-800', hex: '#EDE9FE' },
    'other': { bg: 'bg-gray-100', text: 'text-gray-800', hex: '#F3F4F6' }
};

export default function MaintenancePage() {
    const { toast } = useToast();

    // State
    const [reports, setReports] = useState<MaintenanceReport[]>([]);
    const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [filteredReports, setFilteredReports] = useState<MaintenanceReport[]>([]);
    const [currentFilter, setCurrentFilter] = useState('all');
    
    // Form state
    const [date, setDate] = useState('');
    const [responsible, setResponsible] = useState('');
    const [maintenanceCategory, setMaintenanceCategory] = useState('');
    const [maintenanceItem, setMaintenanceItem] = useState('');
    const [notes, setNotes] = useState('');
    const [completed, setCompleted] = useState(false);
    
    // Search state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchCategory, setSearchCategory] = useState('all');
    const [isSearching, setIsSearching] = useState(false);

    // Modals state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<string | null>(null);
    const [manageCategoriesModalOpen, setManageCategoriesModalOpen] = useState(false);
    const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
    const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<MaintenanceCategory | null>(null);
    const [categoryInUse, setCategoryInUse] = useState(false);

    // Initial load
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setDate(today);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(new Date().getDate() - 30);
        setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
        setEndDate(today);

        const initialize = async () => {
            const categoriesSnapshot = await getDocs(categoriesCollectionRef);
            if (categoriesSnapshot.empty) {
                const batch = writeBatch(db);
                const defaultCategories = [
                    { id: 'cardio', name: 'อุปกรณ์คาร์ดิโอ' },
                    { id: 'strength', name: 'อุปกรณ์เวทเทรนนิ่ง' },
                    { id: 'electrical', name: 'ระบบไฟฟ้า' },
                    { id: 'plumbing', name: 'ระบบประปา' },
                    { id: 'aircon', name: 'ระบบปรับอากาศ' },
                    { id: 'other', name: 'อื่นๆ' }
                ];
                defaultCategories.forEach(category => {
                    const docRef = doc(db, "MaintenanceCategories", category.id);
                    batch.set(docRef, category);
                });
                await batch.commit();
            }
        };

        initialize().then(() => {
            const qCategories = query(categoriesCollectionRef);
            onSnapshot(qCategories, (snapshot) => {
                const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceCategory))
                                                        .sort((a,b) => a.name.localeCompare(b.name));
                setCategories(fetchedCategories);
            });
        });

        const qReports = query(maintenanceCollectionRef, orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(qReports, (snapshot) => {
            const fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceReport));
            setReports(fetchedReports);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching reports:", error);
            toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลรายงานได้", variant: 'destructive' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    // Filtering logic
    useEffect(() => {
        if(isSearching) return;

        let filtered = reports;
        if (currentFilter === 'completed') {
            filtered = reports.filter(r => r.completed);
        } else if (currentFilter === 'pending') {
            filtered = reports.filter(r => !r.completed);
        }
        setFilteredReports(filtered);
    }, [reports, currentFilter, isSearching]);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !responsible || !maintenanceCategory || !maintenanceItem) {
            toast({ title: "ข้อมูลไม่ครบถ้วน", description: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ", variant: 'destructive' });
            return;
        }

        const newReport = {
            date,
            responsible,
            category: maintenanceCategory,
            maintenanceItem,
            notes,
            completed,
            timestamp: serverTimestamp()
        };

        try {
            await addDoc(maintenanceCollectionRef, newReport);
            toast({ title: "บันทึกสำเร็จ", description: "เพิ่มรายการซ่อมบำรุงเรียบร้อย" });
            // Reset form
            setResponsible('');
            setMaintenanceCategory('');
            setMaintenanceItem('');
            setNotes('');
            setCompleted(false);
        } catch (error) {
            console.error("Error adding document: ", error);
            toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกรายการได้", variant: 'destructive' });
        }
    };

    const handleStatusChange = async (id: string, newStatus: boolean) => {
        try {
            const reportDoc = doc(db, "MaintenanceReport1", id);
            await updateDoc(reportDoc, { completed: newStatus });
            toast({ title: "อัปเดตสถานะสำเร็จ" });
        } catch (error) {
            console.error("Error updating status: ", error);
            toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถอัปเดตสถานะได้", variant: 'destructive' });
        }
    };

    const openDeleteDialog = (id: string) => {
        setReportToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleDeleteReport = async () => {
        if (!reportToDelete) return;
        try {
            await deleteDoc(doc(db, "MaintenanceReport1", reportToDelete));
            toast({ title: "ลบรายการสำเร็จ" });
            setDeleteModalOpen(false);
            setReportToDelete(null);
        } catch (error) {
            console.error("Error deleting report: ", error);
            toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบรายการได้", variant: 'destructive' });
        }
    };
    
    const handleSearch = async () => {
        if (!startDate || !endDate) {
            toast({ title: "ข้อมูลไม่ครบถ้วน", description: "กรุณาระบุวันที่เริ่มต้นและสิ้นสุด", variant: "destructive" });
            return;
        }

        setIsSearching(true);
        
        let q = query(
            maintenanceCollectionRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );

        try {
            const snapshot = await getDocs(q);
            let searchResult = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceReport));

            if (searchCategory && searchCategory !== 'all') {
                searchResult = searchResult.filter(report => report.category === searchCategory);
            }
            
            setFilteredReports(searchResult);
            toast({ title: "ค้นหาสำเร็จ", description: `พบ ${searchResult.length} รายการ` });
        } catch(error) {
             console.error("Error searching reports: ", error);
             toast({ title: "เกิดข้อผิดพลาดในการค้นหา", variant: "destructive" });
        }
    };

    const handleFilterClick = (filter: string) => {
        setCurrentFilter(filter);
        setIsSearching(false); // Reset search state when using main filters
    };
    
    const getCategoryName = (categoryId: string) => {
        return categories.find(c => c.id === categoryId)?.name || 'ไม่มีหมวดหมู่';
    };

    return (
        <>
            <header className="bg-slate-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">RCF Maintenance Log</h1>
                        <p className="text-slate-300 text-sm md:text-base">Track and manage equipment maintenance.</p>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {/* Add Report Form */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>เพิ่มรายการซ่อมบำรุง</CardTitle>
                            <Button variant="outline" onClick={() => setManageCategoriesModalOpen(true)}>
                                <Settings className="mr-2 h-4 w-4" />
                                จัดการประเภท
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                <Input placeholder="ผู้รับผิดชอบ" value={responsible} onChange={e => setResponsible(e.target.value)} required />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select value={maintenanceCategory} onValueChange={setMaintenanceCategory} required>
                                    <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input placeholder="รายการซ่อม" value={maintenanceItem} onChange={e => setMaintenanceItem(e.target.value)} required />
                            </div>
                            <Textarea placeholder="หมายเหตุ (ถ้ามี)" value={notes} onChange={e => setNotes(e.target.value)} />
                            <div className="flex items-center space-x-2">
                                <Checkbox id="completed" checked={completed} onCheckedChange={checked => setCompleted(!!checked)} />
                                <label htmlFor="completed">เสร็จสิ้นการซ่อมบำรุง</label>
                            </div>
                            <Button type="submit">บันทึกรายการ</Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Search Panel */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>ค้นหารายงานย้อนหลัง</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            <Select value={searchCategory} onValueChange={setSearchCategory}>
                                <SelectTrigger><SelectValue placeholder="ทุกประเภท" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทุกประเภท</SelectItem>
                                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleSearch}>ค้นหา</Button>
                        </div>
                    </CardContent>
                </Card>


                {/* Reports List */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                            <CardTitle className="mb-3 md:mb-0">รายการซ่อมบำรุงทั้งหมด</CardTitle>
                            <div className="flex space-x-2">
                                <Button variant={currentFilter === 'all' && !isSearching ? 'default' : 'outline'} onClick={() => handleFilterClick('all')}>ทั้งหมด</Button>
                                <Button variant={currentFilter === 'completed' && !isSearching ? 'default' : 'outline'} onClick={() => handleFilterClick('completed')}>เสร็จสิ้น</Button>
                                <Button variant={currentFilter === 'pending' && !isSearching ? 'default' : 'outline'} onClick={() => handleFilterClick('pending')}>รอดำเนินการ</Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {loading ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : filteredReports.length > 0 ? (
                                filteredReports.map(report => {
                                    const categoryStyle = categoryColors[report.category] || categoryColors.other;
                                    return (
                                        <div key={report.id} className={`p-4 rounded-lg shadow-sm border-l-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${report.completed ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500'}`}>
                                            <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                                                <div className="flex-1">
                                                    <div className="flex flex-wrap items-center mb-2 gap-2">
                                                        <span className="text-sm font-medium text-gray-500">{new Date(report.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                        <Badge variant="outline" className={`${categoryStyle.bg} ${categoryStyle.text}`}>{getCategoryName(report.category)}</Badge>
                                                        <Badge variant={report.completed ? 'default' : 'destructive'} className={report.completed ? 'bg-green-600' : 'bg-orange-500'}>{report.completed ? 'เสร็จสิ้น' : 'รอดำเนินการ'}</Badge>
                                                    </div>
                                                    <h3 className="text-lg font-semibold">{report.maintenanceItem}</h3>
                                                    <p className="text-sm text-gray-600 mt-1">ผู้รับผิดชอบ: {report.responsible}</p>
                                                    {report.notes && <p className="text-sm text-gray-500 mt-2 italic">"{report.notes}"</p>}
                                                </div>
                                                <div className="mt-4 md:mt-0 flex items-center space-x-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox id={`status-${report.id}`} checked={report.completed} onCheckedChange={(checked) => handleStatusChange(report.id, !!checked)} />
                                                        <label htmlFor={`status-${report.id}`} className="text-sm">เสร็จสิ้น</label>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => openDeleteDialog(report.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <FileText className="h-12 w-12 mx-auto text-gray-400" />
                                    <p className="mt-2">ยังไม่มีรายการซ่อมบำรุง</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Modals */}
            <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการลบรายการ</AlertDialogTitle>
                        <AlertDialogDescription>คุณต้องการลบรายการนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteReport} className="bg-destructive hover:bg-destructive/90">ยืนยันการลบ</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ManageCategoriesDialog 
                open={manageCategoriesModalOpen} 
                onOpenChange={setManageCategoriesModalOpen}
                categories={categories}
                onAddClick={() => { setManageCategoriesModalOpen(false); setAddCategoryModalOpen(true); }}
                onDeleteClick={async (category) => {
                    setCategoryToDelete(category);
                    try {
                        const reportsSnapshot = await getDocs(query(maintenanceCollectionRef, where('category', '==', category.id), limit(1)));
                        setCategoryInUse(!reportsSnapshot.empty);
                    } catch(e) {
                        console.error(e)
                    }
                    setDeleteCategoryModalOpen(true);
                }}
            />
            
            <AddCategoryDialog 
                open={addCategoryModalOpen} 
                onOpenChange={setAddCategoryModalOpen}
                categories={categories}
            />

            <AlertDialog open={deleteCategoryModalOpen} onOpenChange={setDeleteCategoryModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ยืนยันการลบประเภท</AlertDialogTitle>
                        <AlertDialogDescription>
                            คุณต้องการลบประเภท "{categoryToDelete?.name}" ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                        </AlertDialogDescription>
                        {categoryInUse && (
                             <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-yellow-700">
                                            ประเภทนี้กำลังถูกใช้งานอยู่ในรายการซ่อมบำรุง การลบอาจส่งผลต่อรายงานที่มีอยู่
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setCategoryToDelete(null)}>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={async () => {
                                if (!categoryToDelete) return;
                                try {
                                    await deleteDoc(doc(db, "MaintenanceCategories", categoryToDelete.id));
                                    toast({ title: "ลบประเภทสำเร็จ" });
                                    setDeleteCategoryModalOpen(false);
                                    setCategoryToDelete(null);
                                } catch (error) {
                                    toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบประเภทได้", variant: 'destructive' });
                                }
                            }}
                        >ยืนยันการลบ</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function ManageCategoriesDialog({ open, onOpenChange, categories, onAddClick, onDeleteClick }: { open: boolean, onOpenChange: (open: boolean) => void, categories: MaintenanceCategory[], onAddClick: () => void, onDeleteClick: (category: MaintenanceCategory) => void }) {
    const { toast } = useToast();
    const [editingCategory, setEditingCategory] = useState<MaintenanceCategory | null>(null);
    const [editedName, setEditedName] = useState('');

    const handleEdit = (category: MaintenanceCategory) => {
        setEditingCategory(category);
        setEditedName(category.name);
    }

    const handleSave = async () => {
        if(!editingCategory || !editedName.trim()) return;
        try {
            await updateDoc(doc(db, "MaintenanceCategories", editingCategory.id), { name: editedName });
            toast({ title: "อัปเดตประเภทสำเร็จ" });
            setEditingCategory(null);
        } catch(e) {
            toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>จัดการประเภทการซ่อมบำรุง</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Button onClick={onAddClick} className="mb-4 w-full"><Plus className="mr-2 h-4 w-4"/>เพิ่มประเภทใหม่</Button>
                    <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100">
                                {editingCategory?.id === cat.id ? (
                                    <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus onBlur={handleSave} />
                                ) : (
                                    <div className="flex items-center">
                                        <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: (categoryColors[cat.id] || categoryColors.other).hex }}></div>
                                        <span>{cat.name}</span>
                                    </div>
                                )}
                                
                                {editingCategory?.id !== cat.id && (
                                    <div className="flex items-center space-x-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(cat)}><Edit className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => onDeleteClick(cat)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">ปิด</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AddCategoryDialog({ open, onOpenChange, categories }: { open: boolean, onOpenChange: (open: boolean) => void, categories: MaintenanceCategory[]}) {
    const { toast } = useToast();
    const [id, setId] = useState('');
    const [name, setName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id.trim() || !name.trim()) {
            toast({ title: "ข้อมูลไม่ครบถ้วน", variant: "destructive" });
            return;
        }
        if (categories.some(c => c.id === id.trim().toLowerCase())) {
            toast({ title: "รหัสประเภทซ้ำกัน", description: "กรุณาใช้รหัสอื่น", variant: "destructive"});
            return;
        }
        try {
            await updateDoc(doc(db, "MaintenanceCategories", id.trim().toLowerCase()), { id: id.trim().toLowerCase(), name });
            toast({ title: "เพิ่มประเภทสำเร็จ" });
            setId('');
            setName('');
            onOpenChange(false);
        } catch(e) {
            toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>เพิ่มประเภทใหม่</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <Input placeholder="รหัสประเภท (ภาษาอังกฤษ, e.g. electrical)" value={id} onChange={(e) => setId(e.target.value)} required />
                    <Input placeholder="ชื่อประเภท (ภาษาไทย, e.g. ระบบไฟฟ้า)" value={name} onChange={(e) => setName(e.target.value)} required />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">ยกเลิก</Button></DialogClose>
                        <Button type="submit">บันทึก</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
