"use client";
import { useState, useEffect, useMemo, useTransition as useTransitionReact } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, where, setDoc, writeBatch } from 'firebase/firestore';
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';
import { Chart as ChartJS, ArcElement, Tooltip as ChartJsTooltip, Legend as ChartJsLegend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';

import { FirebaseClientProvider, useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import type { Sale, SalesEmployee, Product, MonthlyTargets, SalespersonTargets } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { BarChart2, Loader2, Plus, Trash2, Edit, Settings, FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import type { Firestore } from 'firebase/firestore';

ChartJS.register(ArcElement, ChartJsTooltip, ChartJsLegend, CategoryScale, LinearScale, BarElement, Title);

const formatCurrency = (amount: number) => `฿${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function SalesPageContent() {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("dashboard");

    const salesQuery = useMemoFirebase(() => db ? query(collection(db, "salesdashboard1"), orderBy('date', 'desc')) : null, [db]);
    const { data: salesData, isLoading: loadingSales } = useCollection<Sale>(salesQuery);
    const sales = salesData || [];

    const employeesQuery = useMemoFirebase(() => db ? collection(db, "salesdashboard1_employees") : null, [db]);
    const { data: employeesData, isLoading: loadingEmployees } = useCollection<SalesEmployee>(employeesQuery);
    const employees = employeesData || [];

    const productsQuery = useMemoFirebase(() => db ? query(collection(db, "salesdashboard1_products"), orderBy('name')) : null, [db]);
    const { data: productsData, isLoading: loadingProducts } = useCollection<Product>(productsQuery);
    const products = productsData || [];

    const monthlyTargetsDoc = useMemoFirebase(() => db ? doc(db, "salesdashboard1_settings", 'monthly_targets') : null, [db]);
    const { data: monthlyTargetsData, isLoading: loadingMonthlyTargets } = useDoc<{targets: MonthlyTargets}>(monthlyTargetsDoc);
    const monthlyTargets = monthlyTargetsData?.targets || {};

    const salespersonTargetsDoc = useMemoFirebase(() => db ? doc(db, "salesdashboard1_settings", 'salesperson_targets') : null, [db]);
    const { data: salespersonTargetsData, isLoading: loadingSalespersonTargets } = useDoc<{targets: SalespersonTargets}>(salespersonTargetsDoc);
    const salespersonTargets = salespersonTargetsData?.targets || {};
    
    const loading = loadingSales || loadingEmployees || loadingProducts || loadingMonthlyTargets || loadingSalespersonTargets;

    // Modals
    const [employeeModal, setEmployeeModal] = useState({ open: false, data: null as SalesEmployee | null });
    const [productModal, setProductModal] = useState({ open: false, data: null as Product | null });
    const [editSaleModal, setEditSaleModal] = useState({ open: false, data: null as Sale | null });
    const [monthlyTargetsModal, setMonthlyTargetsModal] = useState(false);
    const [salespersonTargetsModal, setSalespersonTargetsModal] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, message: string, onConfirm: () => void }>({ open: false, message: '', onConfirm: () => {} });
    const [pdfModalOpen, setPdfModalOpen] = useState(false);

    // Filters for sales report
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterSalesperson, setFilterSalesperson] = useState('all');

    // Initialize default data
    useEffect(() => {
        if (loading || !db) return;
        
        const initDefaults = async () => {
            const productsCollectionRef = collection(db, "salesdashboard1_products");
            const productsSnapshot = await getDocs(productsCollectionRef);
            if (productsSnapshot.empty) {
                 const defaultProducts: Omit<Product, 'id'>[] = [];
                const batch = writeBatch(db);
                defaultProducts.forEach(p => batch.set(doc(collection(db, "salesdashboard1_products")), p));
                await batch.commit();
            }

            const employeesCollectionRef = collection(db, "salesdashboard1_employees");
            const employeesSnapshot = await getDocs(employeesCollectionRef);
            if (employeesSnapshot.empty) {
                 const defaultEmployees: Omit<SalesEmployee, 'id'>[] = [];
                const batch = writeBatch(db);
                defaultEmployees.forEach(e => batch.set(doc(collection(db, "salesdashboard1_employees")), e));
                await batch.commit();
            }
        };
        initDefaults();
    }, [loading, db]);


     // Set default filter dates
    useEffect(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        setFilterStartDate(firstDay);
        setFilterEndDate(lastDay);
    }, [])

    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            const saleDate = sale.date?.toDate ? sale.date.toDate() : new Date(sale.date);
            const start = filterStartDate ? new Date(filterStartDate) : null;
            const end = filterEndDate ? new Date(filterEndDate) : null;
            if (start) start.setHours(0,0,0,0);
            if (end) end.setHours(23,59,59,999);
            
            if(start && saleDate < start) return false;
            if(end && saleDate > end) return false;
            if(filterSalesperson && filterSalesperson !== 'all' && sale.salesperson !== filterSalesperson) return false;

            return true;
        })
    }, [sales, filterStartDate, filterEndDate, filterSalesperson]);

    const showAndHideToast = (title: string, description: string, variant: "default" | "destructive" = "default") => {
        toast({ title, description, variant });
    };

    const openConfirmDialog = (message: string, onConfirm: () => void) => {
        setConfirmDialog({ open: true, message, onConfirm });
    };

    // CRUD functions
    const handleSaveEmployee = async (formData: FormData) => {
        const id = formData.get('id') as string;
        const employeeData = {
            name: formData.get('name') as string,
            position: formData.get('position') as string,
        };

        try {
            if (id) {
                await updateDoc(doc(db, "salesdashboard1_employees", id), employeeData);
                showAndHideToast("Success", "Employee updated.");
            } else {
                await addDoc(collection(db, "salesdashboard1_employees"), employeeData);
                showAndHideToast("Success", "Employee added.");
            }
            setEmployeeModal({ open: false, data: null });
        } catch (e) {
            showAndHideToast("Error", "Could not save employee.", "destructive");
        }
    };
     const handleDeleteEmployee = (id: string) => {
        openConfirmDialog("Are you sure you want to delete this employee?", async () => {
             try {
                await deleteDoc(doc(db, "salesdashboard1_employees", id));
                showAndHideToast("Success", "Employee deleted.");
            } catch (e) {
                showAndHideToast("Error", "Could not delete employee.", "destructive");
            }
        });
    };

    const handleSaveProduct = async (formData: FormData) => {
        const id = formData.get('id') as string;
        const productData = {
            name: formData.get('name') as string,
            category: formData.get('category') as string,
            defaultPrice: Number(formData.get('price')),
        };

        try {
            if (id) {
                await updateDoc(doc(db, "salesdashboard1_products", id), productData);
                showAndHideToast("Success", "Product updated.");
            } else {
                await addDoc(collection(db, "salesdashboard1_products"), productData);
                showAndHideToast("Success", "Product added.");
            }
            setProductModal({ open: false, data: null });
        } catch (e) {
            showAndHideToast("Error", "Could not save product.", "destructive");
        }
    };
    const handleDeleteProduct = (id: string) => {
        openConfirmDialog("Are you sure you want to delete this product?", async () => {
             try {
                await deleteDoc(doc(db, "salesdashboard1_products", id));
                showAndHideToast("Success", "Product deleted.");
            } catch (e) {
                showAndHideToast("Error", "Could not delete product.", "destructive");
            }
        });
    };

    const handleSaveSale = async (formData: FormData) => {
        const saleData = {
            date: new Date(formData.get('date') as string),
            salesperson: formData.get('salesperson') as string,
            memberId: formData.get('memberId') as string,
            memberName: formData.get('memberName') as string,
            product: formData.get('product') as string,
            revenueType: formData.get('revenueType') as string,
            paymentType: formData.get('paymentType') as string,
            amount: Number(formData.get('amount')),
        };
        try {
            await addDoc(collection(db, "salesdashboard1"), saleData);
            showAndHideToast("Success", "Sale recorded.");
        } catch(e) {
            showAndHideToast("Error", "Could not save sale.", "destructive");
        }
    }
    const handleUpdateSale = async (formData: FormData) => {
        const id = formData.get('id') as string;
         const saleData = {
            date: new Date(formData.get('date') as string),
            salesperson: formData.get('salesperson') as string,
            memberId: formData.get('memberId') as string,
            memberName: formData.get('memberName') as string,
            product: formData.get('product') as string,
            revenueType: formData.get('revenueType') as string,
            paymentType: formData.get('paymentType') as string,
            amount: Number(formData.get('amount')),
        };
        try {
            await updateDoc(doc(db, "salesdashboard1", id), saleData);
            showAndHideToast("Success", "Sale updated.");
            setEditSaleModal({ open: false, data: null });
        } catch(e) {
            showAndHideToast("Error", "Could not update sale.", "destructive");
        }
    };
    const handleDeleteSale = (id: string) => {
        openConfirmDialog("Are you sure you want to delete this sale?", async () => {
             try {
                await deleteDoc(doc(db, "salesdashboard1", id));
                showAndHideToast("Success", "Sale deleted.");
            } catch (e) {
                showAndHideToast("Error", "Could not delete sale.", "destructive");
            }
        });
    };

    const handleSaveMonthlyTargets = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const targets = {
            target1: Number(formData.get('target1')),
            target2: Number(formData.get('target2')),
            target3: Number(formData.get('target3')),
        };
        try {
            await setDoc(doc(db, "salesdashboard1_settings", 'monthly_targets'), { targets });
            showAndHideToast("Success", "Monthly targets saved.");
            setMonthlyTargetsModal(false);
        } catch (e) {
            showAndHideToast("Error", "Could not save targets.", "destructive");
        }
    };
    
    const handleSaveSalespersonTargets = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newTargets: SalespersonTargets = {};
        employees.forEach(emp => {
            const empTargets: any = {};
            const t1 = Number(formData.get(`${emp.name}_target1`));
            const t2 = Number(formData.get(`${emp.name}_target2`));
            const t3 = Number(formData.get(`${emp.name}_target3`));
            if(t1 > 0) empTargets.target1 = t1;
            if(t2 > 0) empTargets.target2 = t2;
            if(t3 > 0) empTargets.target3 = t3;
            if(Object.keys(empTargets).length > 0) newTargets[emp.name] = empTargets;
        });

        try {
            await setDoc(doc(db, "salesdashboard1_settings", 'salesperson_targets'), { targets: newTargets });
            showAndHideToast("Success", "Salesperson targets saved.");
            setSalespersonTargetsModal(false);
        } catch (e) {
            showAndHideToast("Error", "Could not save targets.", "destructive");
        }
    };


    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <>
            <header className="bg-slate-900 text-white py-4 md:py-6">
                <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <BarChart2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">RCF Sales Dashboard</h1>
                        <p className="text-slate-300 text-sm md:text-base">Dashboard for sales analytics.</p>
                    </div>
                </div>
            </header>

             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="sticky top-0 z-30 bg-white shadow-md">
                    <div className="container mx-auto">
                        <TabsList className="bg-transparent p-1 h-auto">
                            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                            <TabsTrigger value="sales-entry">Sales Entry</TabsTrigger>
                            <TabsTrigger value="sales-report">Sales Report</TabsTrigger>
                            <TabsTrigger value="employee-management">Employee Mgmt</TabsTrigger>
                            <TabsTrigger value="product-management">Package Mgmt</TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <div className="container mx-auto py-6">
                    <TabsContent value="dashboard">
                        <DashboardTab sales={sales} employees={employees} monthlyTargets={monthlyTargets} salespersonTargets={salespersonTargets} onSetMonthlyTargets={() => setMonthlyTargetsModal(true)} onSetSalespersonTargets={() => setSalespersonTargetsModal(true)} onNavigate={setActiveTab} />
                    </TabsContent>
                    <TabsContent value="sales-entry">
                        <Card>
                            <CardHeader>
                                <CardTitle>New Sale Entry</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form action={handleSaveSale} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label htmlFor="sale-date">Date</Label>
                                        <Input type="date" id="sale-date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                                    </div>
                                    <div>
                                        <Label htmlFor="member-id">Member ID</Label>
                                        <Input id="member-id" name="memberId" placeholder="e.g. A001" required />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Label htmlFor="member-name">Member Name</Label>
                                        <Input id="member-name" name="memberName" placeholder="e.g. John Doe" required />
                                    </div>
                                    
                                    <ProductSelect products={products} name="product"/>
                                    
                                    <div>
                                      <Label htmlFor="revenue-type">Revenue Type</Label>
                                      <Select name="revenueType" required>
                                        <SelectTrigger id="revenue-type"><SelectValue placeholder="Select revenue type" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="New New">New New</SelectItem>
                                          <SelectItem value="Renew">Renew</SelectItem>
                                          <SelectItem value="Upgrade">Upgrade</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                      <Label htmlFor="payment-type">Payment Type</Label>
                                      <Select name="paymentType" required>
                                        <SelectTrigger id="payment-type"><SelectValue placeholder="Select payment type" /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Cash">Cash</SelectItem>
                                          <SelectItem value="Transfer">Transfer</SelectItem>
                                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="sale-amount">Sale Amount (฿)</Label>
                                        <Input type="number" id="sale-amount" name="amount" placeholder="0.00" min="0" step="0.01" required />
                                    </div>

                                    <SalespersonSelect employees={employees} name="salesperson" />

                                    <div className="md:col-span-2">
                                        <Button type="submit" className="w-full bg-green-500 hover:bg-green-600">Save Sale</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="sales-report">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                                    <CardTitle className="mb-3 md:mb-0">Sales Report</CardTitle>
                                    <Button onClick={() => setPdfModalOpen(true)}>
                                        <FileText className="mr-2 h-4 w-4"/>
                                        Generate PDF
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div>
                                        <Label htmlFor="filter-start-date">Start Date</Label>
                                        <Input type="date" id="filter-start-date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="filter-end-date">End Date</Label>
                                        <Input type="date" id="filter-end-date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                                    </div>
                                    <SalespersonSelect employees={employees} value={filterSalesperson} onValueChange={setFilterSalesperson} includeAll/>
                                </div>
                                <div className="text-right font-bold mb-4">
                                    Total: {formatCurrency(filteredSales.reduce((sum, s) => sum + s.amount, 0))}
                                </div>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Member ID</TableHead>
                                                <TableHead>Member Name</TableHead>
                                                <TableHead>Salesperson</TableHead>
                                                <TableHead>Package</TableHead>
                                                <TableHead>Revenue Type</TableHead>
                                                <TableHead>Payment Type</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredSales.map(sale => (
                                                <TableRow key={sale.id}>
                                                    <TableCell>{sale.date?.toDate ? sale.date.toDate().toLocaleDateString() : new Date(sale.date).toLocaleDateString()}</TableCell>
                                                    <TableCell>{sale.memberId}</TableCell>
                                                    <TableCell>{sale.memberName}</TableCell>
                                                    <TableCell>{sale.salesperson}</TableCell>
                                                    <TableCell>{sale.product}</TableCell>
                                                    <TableCell>{sale.revenueType}</TableCell>
                                                    <TableCell>{sale.paymentType}</TableCell>
                                                    <TableCell>{formatCurrency(sale.amount)}</TableCell>
                                                    <TableCell className="flex gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => setEditSaleModal({open: true, data: sale})}><Edit className="w-4 h-4"/></Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteSale(sale.id)}><Trash2 className="w-4 h-4"/></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="employee-management">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Employee Management</CardTitle>
                                <Button onClick={() => setEmployeeModal({ open: true, data: null })}>Add New Employee</Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Position</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {employees.map(emp => (
                                            <TableRow key={emp.id}>
                                                <TableCell>{emp.name}</TableCell>
                                                <TableCell>{emp.position}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setEmployeeModal({ open: true, data: emp })}><Edit className="w-4 h-4"/></Button>
                                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteEmployee(emp.id)}><Trash2 className="w-4 h-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="product-management">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Package Management</CardTitle>
                                <Button onClick={() => setProductModal({ open: true, data: null })}>Add New Package</Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Package Name</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Default Price</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {products.map(prod => (
                                            <TableRow key={prod.id}>
                                                <TableCell>{prod.name}</TableCell>
                                                <TableCell>{prod.category}</TableCell>
                                                <TableCell>{formatCurrency(prod.defaultPrice)}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setProductModal({ open: true, data: prod })}><Edit className="w-4 h-4"/></Button>
                                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteProduct(prod.id)}><Trash2 className="w-4 h-4"/></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>

            {/* Modals */}
             <ConfirmationDialog
                open={confirmDialog.open}
                onOpenChange={(open) => setConfirmDialog(p => ({...p, open}))}
                title="Are you sure?"
                description={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
            />

            <EmployeeModal 
                open={employeeModal.open}
                onOpenChange={(open) => setEmployeeModal({ open, data: null })}
                employee={employeeModal.data}
                onSave={handleSaveEmployee}
                db={db}
            />
            <ProductModal 
                open={productModal.open}
                onOpenChange={(open) => setProductModal({ open, data: null })}
                product={productModal.data}
                onSave={handleSaveProduct}
                db={db}
            />
             <EditSaleModal
                open={editSaleModal.open}
                onOpenChange={(open) => setEditSaleModal({ open, data: null })}
                sale={editSaleModal.data}
                employees={employees}
                products={products}
                onSave={handleUpdateSale}
                db={db}
            />
             <MonthlyTargetsModal
                open={monthlyTargetsModal}
                onOpenChange={setMonthlyTargetsModal}
                targets={monthlyTargets}
                onSave={handleSaveMonthlyTargets}
                db={db}
            />
            <SalespersonTargetsModal
                open={salespersonTargetsModal}
                onOpenChange={setSalespersonTargetsModal}
                targets={salespersonTargets}
                employees={employees}
                onSave={handleSaveSalespersonTargets}
                db={db}
            />
            <PDFExportModal
                open={pdfModalOpen}
                onOpenChange={setPdfModalOpen}
                employees={employees}
                sales={sales}
                defaultSalesperson={filterSalesperson}
                startDate={filterStartDate}
                endDate={filterEndDate}
            />
        </>
    );
}

export default function SalesPage() {
    return (
        <FirebaseClientProvider>
            <SalesPageContent />
        </FirebaseClientProvider>
    )
}

// Sub-components for better organization

function DashboardTab({ sales, employees, monthlyTargets, salespersonTargets, onSetMonthlyTargets, onSetSalespersonTargets, onNavigate }: any) {
    
    const [todayDate, setTodayDate] = useState('');
    const [currentMonth, setCurrentMonth] = useState('');

    useEffect(() => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(2);
        setTodayDate(`${day}/${month}/${year}`);

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        setCurrentMonth(monthNames[now.getMonth()] + ' ' + now.getFullYear());
    }, []);

    const { todaySales, monthlySales, totalTransactions, recentSales, salespersonChartData, productChartDataValue } = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const todaySalesValue = sales.filter((s: Sale) => s.date?.toDate ? s.date.toDate() >= today : new Date(s.date) >= today).reduce((sum: number, s: Sale) => sum + s.amount, 0);
        const monthlySalesList = sales.filter((s: Sale) => s.date?.toDate ? s.date.toDate() >= firstDayOfMonth : new Date(s.date) >= firstDayOfMonth);
        const monthlySalesValue = monthlySalesList.reduce((sum: number, s: Sale) => sum + s.amount, 0);
        const totalTransactionsValue = monthlySalesList.length;
        const recentSalesData = sales.slice(0, 5);

        const salespersonData = employees.map((emp: SalesEmployee) => ({
            id: emp.id,
            name: emp.name,
            sales: monthlySalesList.filter(s => s.salesperson === emp.name).reduce((sum, s) => sum + s.amount, 0),
        }));

        const productChartDataValue = [
            { name: 'Membership', value: monthlySalesList.filter(s => s.product.includes('Annual') || s.product.includes('Month') || s.product.includes('Punch Card')).reduce((sum, s) => sum + s.amount, 0) },
            { name: 'Personal Training', value: monthlySalesList.filter(s => s.product.includes('PT') || s.product.includes('Boxing')).reduce((sum, s) => sum + s.amount, 0) },
            { name: 'Food & Beverage', value: monthlySalesList.filter(s => s.product.includes('Food & Beverage')).reduce((sum, s) => sum + s.amount, 0) },
            { name: 'Proshop', value: monthlySalesList.filter(s => s.product.includes('Proshop')).reduce((sum, s) => sum + s.amount, 0) },
            { name: 'Daily Pass', value: monthlySalesList.filter(s => s.product.includes('Daily')).reduce((sum, s) => sum + s.amount, 0) },
        ].filter(item => item.value > 0);

        return { todaySales: todaySalesValue, monthlySales: monthlySalesValue, totalTransactions: totalTransactionsValue, recentSales: recentSalesData, salespersonChartData: salespersonData, productChartDataValue};
    }, [sales, employees]);
    
    const productCategoryColors: {[key: string]: string} = {
        'Membership': '#3b82f6',
        'Personal Training': '#10b981',
        'Food & Beverage': '#f59e0b',
        'Proshop': '#ef4444',
        'Daily Pass': '#8b5cf6'
    };

    const pieChartData = productChartDataValue.map((entry: any) => ({
      ...entry,
      fill: productCategoryColors[entry.name] || '#6b7280',
    }));
    
    return (
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-primary to-blue-700 text-white hover-lift">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-white/90">Today's Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{formatCurrency(todaySales)}</p>
                        <p className="text-sm text-white/80 mt-2">{todayDate}</p>
                    </CardContent>
                </Card>
                <Card className="hover-lift bg-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-semibold text-gray-700">Monthly Sales</CardTitle>
                        <Button variant="link" className="text-primary" onClick={onSetMonthlyTargets}>Set Targets</Button>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(monthlySales)}</p>
                        <p className="text-sm text-gray-500 mt-2">{currentMonth}</p>
                         <div id="monthly-targets-display" className="mt-4 space-y-2">
                            {Object.entries(monthlyTargets).map(([key, value]) => {
                                if (!value) return null;
                                const targetAmount = value as number;
                                const progress = Math.min((monthlySales / targetAmount) * 100, 100);
                                const progressColor = progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-yellow-500' : 'bg-red-500';
                                return (
                                <div key={key}>
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Target {key.replace('target', '')}: {formatCurrency(targetAmount)}</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                        <div className={`${progressColor} h-2 rounded-full`} style={{ width: `${progress}%` }}></div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </CardContent>
                </Card>
                <Card className="hover-lift bg-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-700">Total Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-purple-600">{totalTransactions}</p>
                        <p className="text-sm text-gray-500 mt-2">This month</p>
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg font-bold text-gray-800">Sales by Salesperson</CardTitle>
                        <Button variant="link" className="text-primary" onClick={onSetSalespersonTargets}>Set Targets</Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {salespersonChartData.length > 0 ? (
                                salespersonChartData.map((salesperson: any) => {
                                    const currentSales = salesperson.sales || 0;
                                    const targets = salespersonTargets[salesperson.name] || {};

                                    return (
                                        <div key={salesperson.id} className="p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-xl text-gray-800 mb-1">{salesperson.name}</h4>
                                            <p className="text-sm text-gray-600 mb-4">Current Sales: {formatCurrency(currentSales)}</p>
                                            
                                            <div className="space-y-3">
                                                {Object.keys(targets).length > 0 ? (
                                                    Object.entries(targets).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([targetKey, targetValue]) => {
                                                        if (!targetValue || (targetValue as number) <= 0) return null;
                                                        const targetAmount = targetValue as number;
                                                        const progress = Math.min((currentSales / targetAmount) * 100, 100);
                                                        const remaining = Math.max(0, targetAmount - currentSales);

                                                        return (
                                                            <div key={targetKey}>
                                                                <div className="flex justify-between items-center text-sm text-gray-600 mb-1">
                                                                    <span>Target {targetKey.replace('target', '')}: {formatCurrency(targetAmount)}</span>
                                                                    <span className="text-xs">{Math.round(progress)}% ({formatCurrency(remaining)})</span>
                                                                </div>
                                                                <Progress value={progress} className="h-2" />
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-sm text-gray-400 italic">No targets set for this salesperson.</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                 <div className="text-gray-500 text-sm text-center py-4">No sales data for this period.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-lg font-bold text-gray-800">Product Category Sales</CardTitle></CardHeader>
                     <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                                    {pieChartData.map((entry:any, index:number) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                                <Legend iconSize={10} wrapperStyle={{fontSize: "12px"}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-bold text-gray-800">Recent Sales</CardTitle>
                    <Button onClick={() => onNavigate('sales-report')}>View All</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Salesperson</TableHead>
                                <TableHead>Package</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentSales.map((sale: Sale) => (
                                <TableRow key={sale.id}>
                                    <TableCell>{sale.date?.toDate ? sale.date.toDate().toLocaleDateString() : new Date(sale.date).toLocaleDateString()}</TableCell>
                                    <TableCell>{sale.salesperson}</TableCell>
                                    <TableCell>{sale.product}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(sale.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

function EmployeeModal({ open, onOpenChange, employee, onSave, db }: { open: boolean, onOpenChange: (open: boolean) => void, employee: SalesEmployee | null, onSave: (data: FormData) => void, db: Firestore }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{employee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
                </DialogHeader>
                <form action={onSave} className="space-y-4">
                    <input type="hidden" name="id" value={employee?.id || ''} />
                    <div>
                        <Label htmlFor="employee-name">Name</Label>
                        <Input id="employee-name" name="name" defaultValue={employee?.name} required />
                    </div>
                    <div>
                        <Label htmlFor="employee-position">Position</Label>
                        <Input id="employee-position" name="position" defaultValue={employee?.position} required />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function ProductModal({ open, onOpenChange, product, onSave, db }: { open: boolean, onOpenChange: (open: boolean) => void, product: Product | null, onSave: (data: FormData) => void, db: Firestore }) {
    const categories = ['Membership', 'Punch Card', 'Personal Training', 'Boxing Training', 'Daily Pass', 'Proshop', 'Food & Beverage'];
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{product ? 'Edit Package' : 'Add New Package'}</DialogTitle>
                </DialogHeader>
                <form action={onSave} className="space-y-4">
                    <input type="hidden" name="id" value={product?.id || ''} />
                    <div>
                        <Label htmlFor="product-name">Package Name</Label>
                        <Input id="product-name" name="name" defaultValue={product?.name} required />
                    </div>
                    <div>
                         <Label htmlFor="product-category">Category</Label>
                         <Select name="category" defaultValue={product?.category}>
                            <SelectTrigger id="product-category"><SelectValue placeholder="Select category"/></SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                         </Select>
                    </div>
                    <div>
                        <Label htmlFor="product-price">Default Price (฿)</Label>
                        <Input id="product-price" name="price" type="number" defaultValue={product?.defaultPrice} min="0" step="0.01" required />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function EditSaleModal({ open, onOpenChange, sale, employees, products, onSave, db }: { open: boolean, onOpenChange: (open: boolean) => void, sale: Sale | null, employees: SalesEmployee[], products: Product[], onSave: (data: FormData) => void, db: Firestore }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Sale</DialogTitle>
                </DialogHeader>
                 <form action={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="hidden" name="id" value={sale?.id || ''} />
                     <div>
                        <Label htmlFor="edit-sale-date">Date</Label>
                        <Input type="date" id="edit-sale-date" name="date" defaultValue={sale?.date?.toDate ? sale.date.toDate().toISOString().split('T')[0] : ''} required />
                    </div>
                    <SalespersonSelect employees={employees} name="salesperson" defaultValue={sale?.salesperson} />

                    <div>
                        <Label htmlFor="edit-member-id">Member ID</Label>
                        <Input id="edit-member-id" name="memberId" defaultValue={sale?.memberId} required />
                    </div>
                    <div>
                        <Label htmlFor="edit-member-name">Member Name</Label>
                        <Input id="edit-member-name" name="memberName" defaultValue={sale?.memberName} required />
                    </div>
                    
                    <ProductSelect products={products} name="product" defaultValue={sale?.product}/>

                    <div>
                        <Label htmlFor="edit-revenue-type">Revenue Type</Label>
                        <Select name="revenueType" defaultValue={sale?.revenueType} required>
                            <SelectTrigger id="edit-revenue-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="New New">New New</SelectItem>
                                <SelectItem value="Renew">Renew</SelectItem>
                                <SelectItem value="Upgrade">Upgrade</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="edit-payment-type">Payment Type</Label>
                        <Select name="paymentType" defaultValue={sale?.paymentType} required>
                            <SelectTrigger id="edit-payment-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Cash">Cash</SelectItem>
                                <SelectItem value="Transfer">Transfer</SelectItem>
                                <SelectItem value="Credit Card">Credit Card</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="edit-sale-amount">Sale Amount (฿)</Label>
                        <Input type="number" id="edit-sale-amount" name="amount" defaultValue={sale?.amount} min="0" step="0.01" required />
                    </div>
                     <DialogFooter className="md:col-span-2">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function MonthlyTargetsModal({ open, onOpenChange, targets, onSave, db }: any) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Set Monthly Sales Targets</DialogTitle></DialogHeader>
                 <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <Label htmlFor="monthly-target-1">Target 1 (฿)</Label>
                        <Input type="number" id="monthly-target-1" name="target1" min="0" step="0.01" placeholder="550,000" defaultValue={targets?.target1} />
                    </div>
                    <div>
                        <Label htmlFor="monthly-target-2">Target 2 (฿)</Label>
                        <Input type="number" id="monthly-target-2" name="target2" min="0" step="0.01" placeholder="700,000" defaultValue={targets?.target2} />
                    </div>
                    <div>
                        <Label htmlFor="monthly-target-3">Target 3 (฿)</Label>
                        <Input type="number" id="monthly-target-3" name="target3" min="0" step="0.01" placeholder="900,000" defaultValue={targets?.target3} />
                    </div>
                     <DialogFooter className="md:col-span-3">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save Targets</Button>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    )
}

function SalespersonTargetsModal({ open, onOpenChange, targets, employees, onSave, db }: any) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                 <DialogHeader><DialogTitle>Set Salesperson Targets</DialogTitle></DialogHeader>
                 <form onSubmit={onSave} className="space-y-4">
                     <div className="max-h-96 overflow-y-auto pr-2">
                     {employees.map((emp: SalesEmployee) => (
                         <div key={emp.id} className="p-4 border rounded-lg mb-4">
                             <h4 className="font-semibold mb-2">{emp.name}</h4>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <Label htmlFor={`${emp.name}_target1`}>Target 1 (฿)</Label>
                                    <Input type="number" name={`${emp.name}_target1`} min="0" step="0.01" placeholder="150,000" defaultValue={targets?.[emp.name]?.target1} />
                                </div>
                                <div>
                                    <Label htmlFor={`${emp.name}_target2`}>Target 2 (฿)</Label>
                                    <Input type="number" name={`${emp.name}_target2`} min="0" step="0.01" placeholder="190,000" defaultValue={targets?.[emp.name]?.target2} />
                                </div>
                                <div>
                                    <Label htmlFor={`${emp.name}_target3`}>Target 3 (฿)</Label>
                                    <Input type="number" name={`${emp.name}_target3`} min="0" step="0.01" placeholder="250,000" defaultValue={targets?.[emp.name]?.target3} />
                                </div>
                             </div>
                         </div>
                     ))}
                     </div>
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Save Targets</Button>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    )
}

function SalespersonSelect({ employees, value, onValueChange, includeAll = false, name = "salesperson", defaultValue = "" }: { employees: SalesEmployee[], value?: string, onValueChange?: (value: string) => void, includeAll?: boolean, name?: string, defaultValue?: string }) {
    const uniqueEmployees = employees.filter(
        (employee, index, self) => index === self.findIndex((e) => e.name === employee.name)
    );
    
    return (
        <div>
            <Label htmlFor={name}>Salesperson</Label>
            <Select name={name} value={value} onValueChange={onValueChange} defaultValue={defaultValue}>
                <SelectTrigger id={name}><SelectValue placeholder={includeAll ? "All Salespersons" : "Select Salesperson"} /></SelectTrigger>
                <SelectContent>
                    {includeAll && <SelectItem value="all">All Salespersons</SelectItem>}
                    {uniqueEmployees.map(emp => <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    )
}

function ProductSelect({ products, name = "product", defaultValue = "" } : { products: Product[], name?: string, defaultValue?: string }) {
    const uniqueProducts = products.filter(
        (product, index, self) => index === self.findIndex((p) => p.name === product.name)
    );

    return (
        <div>
            <Label htmlFor={name}>Package</Label>
             <Select name={name} defaultValue={defaultValue}>
                <SelectTrigger id={name}><SelectValue placeholder="Select Package" /></SelectTrigger>
                <SelectContent>
                    {uniqueProducts.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    )
}
function ConfirmationDialog({ open, onOpenChange, title, description, onConfirm }: { open: boolean, onOpenChange: (open: boolean) => void, title: string, description: string, onConfirm: () => void }) {
    const [isPending, startTransition] = useTransitionReact();
    const handleConfirm = () => {
        startTransition(async () => {
            onConfirm();
            onOpenChange(false);
        });
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function PDFExportModal({ open, onOpenChange, employees, sales, defaultSalesperson, startDate, endDate }: { open: boolean, onOpenChange: (open: boolean) => void, employees: SalesEmployee[], sales: Sale[], defaultSalesperson: string, startDate: string, endDate: string }) {
    const { toast } = useToast();

    const generateSalesReportPDF = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const selectedSalesperson = formData.get('salesperson') as string;
        
        const salespersonName = selectedSalesperson === 'all' ? 'All Salespersons' : selectedSalesperson;

        const filtered = sales.filter(sale => {
            const saleDate = sale.date?.toDate ? sale.date.toDate() : new Date(sale.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (start) start.setHours(0,0,0,0);
            if (end) end.setHours(23,59,59,999);
            
            if(start && saleDate < start) return false;
            if(end && saleDate > end) return false;
            if(selectedSalesperson && selectedSalesperson !== 'all' && sale.salesperson !== selectedSalesperson) return false;
            return true;
        }).sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
            return dateA.getTime() - dateB.getTime();
        });

        if (filtered.length === 0) {
            toast({ title: "No data", description: "No sales data found for the selected criteria.", variant: "destructive" });
            return;
        }

        const totalAmount = filtered.reduce((sum, s) => sum + s.amount, 0);

        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Sales Report - ${salespersonName}</title>
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
                    td { padding: 5px 8px; border: 1px solid #ccc; font-size: 11px; }
                    tr:nth-child(even) { background: #fafafa; }
                    .amount { text-align: right; font-weight: bold; }
                    .total-row { background: #e8e8e8; font-weight: bold; border-top: 2px solid #000; }
                    .summary-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
                    .summary-card { border: 1px solid #999; padding: 10px; text-align: center; }
                    .summary-card .label { font-size: 10px; font-weight: bold; margin-bottom: 6px; }
                    .summary-card .value { font-size: 16px; font-weight: bold; }
                    .no-data { text-align: center; padding: 20px; color: #666; background: #f5f5f5; border: 1px solid #ccc; }
                    .footer { margin-top: 25px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
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
                        <h1>SALES REPORT</h1>
                        <div class="header-info">
                            <div><strong>Salesperson:</strong> ${salespersonName}</div>
                            <div><strong>Period:</strong> ${new Date(startDate).toLocaleDateString('en-GB')} to ${new Date(endDate).toLocaleDateString('en-GB')}</div>
                        </div>
                    </div>

                    <div class="summary-cards">
                         <div class="summary-card">
                            <div class="label">Total Transactions</div>
                            <div class="value">${filtered.length}</div>
                        </div>
                        <div class="summary-card">
                            <div class="label">Total Sales</div>
                            <div class="value">${formatCurrency(totalAmount)}</div>
                        </div>
                    </div>
                    
                    <h2>SALES DETAILS</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Member ID</th>
                                <th>Member Name</th>
                                <th>Package</th>
                                <th>Revenue Type</th>
                                <th>Payment Type</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(sale => `
                                <tr>
                                    <td>${sale.date?.toDate ? sale.date.toDate().toLocaleDateString('en-GB') : new Date(sale.date).toLocaleDateString('en-GB')}</td>
                                    <td>${sale.memberId || '-'}</td>
                                    <td>${sale.memberName || '-'}</td>
                                    <td>${sale.product || '-'}</td>
                                    <td>${sale.revenueType || '-'}</td>
                                    <td>${sale.paymentType || '-'}</td>
                                    <td class="amount">${formatCurrency(sale.amount)}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="6" style="text-align: right;">TOTAL:</td>
                                <td class="amount">${formatCurrency(totalAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                     <div class="footer">
                        <p>Generated on ${new Date().toLocaleString('en-GB')}</p>
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generate Sales Report</DialogTitle>
                    <DialogDescription>
                        The report will be generated for the date range currently selected on the report page: 
                        <strong> ${startDate}</strong> to <strong>${endDate}</strong>.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={generateSalesReportPDF} className="space-y-4 pt-4">
                    <SalespersonSelect 
                        employees={employees} 
                        includeAll 
                        defaultValue={defaultSalesperson}
                    />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Generate PDF</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}