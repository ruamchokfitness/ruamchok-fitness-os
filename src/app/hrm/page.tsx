
'use client';
import { ArrowLeft, UserPlus, Users, Loader2, FileText, Clock, CalendarClock, FileArchive, Download, UserMinus, History } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { EmployeeGrid } from "@/components/employees/employee-grid";
import { PolicyFooter } from "@/components/policies/policy-footer";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";
import { HrmEFormDialog } from "@/components/hrm/forms/hrm-eform-dialog";
import { HrmHistoryDialog } from "@/components/hrm/forms/hrm-history-dialog";
import type { HrmFormType } from "@/lib/hrm-forms-types";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, writeBatch, doc, getDocs, limit, orderBy } from 'firebase/firestore';
import type { Employee, Leave, Quota, Policy, VacationTier, PublicHoliday, User } from "@/lib/types";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";


function HrmHeader() {
    const { firestore } = useFirebase();
    const policiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "policies")) : null, [firestore]);
    const { data: policies } = useCollection<Policy>(policiesQuery);
    const systemTitle = policies?.find(p => p.key === 'system_title')?.value || 'RCF HRM';

    return (
        <header className="bg-slate-900 text-white py-4 md:py-6">
            <div className="container mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="outline" size="icon" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">{systemTitle}</h1>
                        <p className="text-slate-300 text-sm md:text-base">Employee leave management system.</p>
                    </div>
                </div>
            </div>
        </header>
    )
}

// This is the seeding logic moved from src/lib/data.ts
const seedInitialData = async (firestore: any) => {
    const policiesCollectionRef = collection(firestore, "policies");
    const policiesSnapshot = await getDocs(query(policiesCollectionRef, limit(1)));
    if (policiesSnapshot.empty) {
        console.log("No policies found. Seeding initial data...");
        const batch = writeBatch(firestore);

        const initialPolicies: Policy[] = [
            { key: 'system_title', value: 'RuamChok Fitness HRM'},
            { key: 'notes_header_text', value: 'หมายเหตุ'},
            { key: 'vacation_policy_text', value: '*พนักงานที่มีอายุงานครบ 1 ปีขึ้นไป สามารถใช้สิทธิ์พักร้อนได้ 6 วันต่อปี' },
            { key: 'holiday_policy_text', value: '**สิทธิ์วันหยุดนักขัตฤกษ์ ใช้ได้ 8 วันต่อปี (ไม่รวมปีใหม่-สงกรานต์เนื่องจากหยุดตามปีปฏิทิน)' },
            { key: 'holiday_restriction_text', value: '***นักขัตฤกษ์ใช้วันซ้ำกันไม่ได้ ยกเว้นใช้สิทธิ์หยุดไปแค่ 0.5 วัน' },
            { key: 'holiday_year_text', value: 'สิทธิ์วันหยุดนักขัตฤกษ์ที่ใช้ได้'},
        ];

        const initialVacationTiers: VacationTier[] = [
          { id: 'vt1', years: 'ครบ 1 ปี', days: '6 วัน' },
          { id: 'vt2', years: 'ครบ 3 ปี', days: '8 วัน' },
          { id: 'vt3', years: 'ครบ 5 ปี', days: '10 วัน' },
          { id: 'vt4', years: 'ครบ 6 ปี', days: '11 วัน' },
          { id: 'vt5', years: 'ครบ 7 ปี', days: '12 วัน' },
          { id: 'vt6', years: 'ครบ 8 ปี', days: '13 วัน' },
          { id: 'vt7', years: 'ครบ 9 ปี', days: '14 วัน' },
          { id: 'vt8', years: 'ครบ 10 ปีขึ้นไป', days: '15 วัน' },
        ];
        
        const initialPublicHolidays: PublicHoliday[] = [
          { id: 'ph1', name: 'วันมาฆบูชา', date: '3 มีนาคม 2569' },
          { id: 'ph2', name: 'วันแรงงาน', date: '1 พฤษภาคม 2569' },
          { id: 'ph3', name: 'วันวิสาขบูชา', date: '1 มิถุนายน 2569' },
          { id: 'ph4', name: 'วันอาสาฬหบูชา', date: '29 มิถุนายน 2569' },
          { id: 'ph5', name: 'วันแม่', date: '12 สิงหาคม 2569' },
          { id: 'ph6', name: 'วันคล้ายวันสวรรคต ร.9', date: '13 ตุลาคม 2569' },
          { id: 'ph7', name: 'วันปิยะมหาราช', date: '23 ตุลาคม 2569' },
          { id: 'ph8', name: 'วันพ่อ', date: '5 ธันวาคม 2569' },
        ];

        initialPolicies.forEach(p => batch.set(doc(collection(firestore, "policies"), p.key), p));
        initialVacationTiers.forEach(vt => batch.set(doc(collection(firestore, "vacationTiers"), vt.id), vt));
        initialPublicHolidays.forEach(ph => batch.set(doc(collection(firestore, "publicHolidays"), ph.id), ph));
        
        await batch.commit();
        console.log("Initial data seeded successfully.");
    }
}


function HrmPageContent() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [seeding, setSeeding] = useState(true);
    const [eformDialogOpen, setEformDialogOpen] = useState(false);
    const [activeFormType, setActiveFormType] = useState<HrmFormType>('leave');
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

    const openEForm = (type: HrmFormType) => {
        setActiveFormType(type);
        setEformDialogOpen(true);
    };

    const employeesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "employees"), orderBy('name')) : null, [firestore]);
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const leavesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "leaves"), orderBy('date', 'desc')) : null, [firestore]);
    const { data: leaves } = useCollection<Leave>(leavesQuery);

    useEffect(() => {
        if (firestore) {
            seedInitialData(firestore).finally(() => setSeeding(false));
        }
    }, [firestore]);

    const generateExcelReport = () => {
        if (!leaves || leaves.length === 0) {
            toast({ title: "No data", description: "No leave records to export.", variant: "destructive" });
            return;
        }

        const sorted = [...leaves].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let csvContent = "\uFEFF"; 
        const headers = ["Date", "Employee Name", "Leave Type", "Duration (Days)"];
        csvContent += headers.join(",") + "\n";

        sorted.forEach(l => {
            const empName = employees?.find(e => e.id === l.employeeId)?.name || 'Unknown';
            const row = [
                `"${l.date}"`,
                `"${empName}"`,
                `"${l.type}"`,
                l.days
            ];
            csvContent += row.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `HRM_Leave_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (seeding) {
        return (
            <div className="flex h-[calc(100vh-150px)] w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-8 p-4 bg-card rounded-xl shadow-sm border">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">ยื่นคำร้องออนไลน์ / เอกสาร (E-Forms)</h3>
                        <p className="text-xs text-muted-foreground">ระบบบันทึกเอกสารคำร้องออนไลน์ กรอกง่าย สะดวกบนมือถือ พร้อมสร้างแบบฟอร์มทางการ</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => setHistoryDialogOpen(true)}
                        className="gap-1.5 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                        <History className="w-3.5 h-3.5 text-slate-600" />
                        ประวัติการยื่นคำร้องทั้งหมด
                    </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => openEForm('leave')}
                        className="w-full justify-start text-left h-auto py-3 px-3.5 border-blue-200 hover:bg-blue-50/60 hover:border-blue-300 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mr-2.5 shrink-0 group-hover:scale-105 transition-transform">
                            <FileText className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-bold text-xs text-slate-900">ใบลา</p>
                            <p className="text-[11px] text-muted-foreground">Leave Form</p>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => openEForm('overtime')}
                        className="w-full justify-start text-left h-auto py-3 px-3.5 border-orange-200 hover:bg-orange-50/60 hover:border-orange-300 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center mr-2.5 shrink-0 group-hover:scale-105 transition-transform">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-bold text-xs text-slate-900">ใบทำงานล่วงเวลา</p>
                            <p className="text-[11px] text-muted-foreground">Overtime Form</p>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => openEForm('timesheet')}
                        className="w-full justify-start text-left h-auto py-3 px-3.5 border-emerald-200 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mr-2.5 shrink-0 group-hover:scale-105 transition-transform">
                            <CalendarClock className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-bold text-xs text-slate-900">ใบลงเวลาทำงาน</p>
                            <p className="text-[11px] text-muted-foreground">Timesheet Form</p>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => openEForm('internal_memo')}
                        className="w-full justify-start text-left h-auto py-3 px-3.5 border-purple-200 hover:bg-purple-50/60 hover:border-purple-300 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mr-2.5 shrink-0 group-hover:scale-105 transition-transform">
                            <FileArchive className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-bold text-xs text-slate-900">ใบขอเอกสาร / ติดต่อ</p>
                            <p className="text-[11px] text-muted-foreground">Document Request</p>
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => openEForm('resignation')}
                        className="w-full justify-start text-left h-auto py-3 px-3.5 border-rose-200 hover:bg-rose-50/60 hover:border-rose-300 transition-all group col-span-2 sm:col-span-1"
                    >
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center mr-2.5 shrink-0 group-hover:scale-105 transition-transform">
                            <UserMinus className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="font-bold text-xs text-slate-900">ใบลาออก</p>
                            <p className="text-[11px] text-muted-foreground">Resignation Form</p>
                        </div>
                    </Button>
                </div>
            </div>

            {/* Interactive E-Form Dialog */}
            <HrmEFormDialog
                open={eformDialogOpen}
                onOpenChange={setEformDialogOpen}
                formType={activeFormType}
                onFormTypeChange={setActiveFormType}
                employees={employees || []}
            />

            {/* History of Submitted E-Forms */}
            <HrmHistoryDialog
                open={historyDialogOpen}
                onOpenChange={setHistoryDialogOpen}
            />
            <div className="flex justify-end mb-8 gap-2">
            <Button variant="outline" onClick={generateExcelReport}>
                <Download className="mr-2 h-4 w-4" />
                Export Leave Excel
            </Button>
            <AddEmployeeDialog>
                <Button className="transition-transform hover:scale-105">
                <UserPlus className="mr-2 h-5 w-5" />
                เพิ่มพนักงาน
                </Button>
            </AddEmployeeDialog>
            </div>
            <main className="mb-12">
            <EmployeeGrid />
            </main>
            <PolicyFooter />
        </>
    )
}

export default function HrmPage() {
  return (
    <>
      <HrmHeader />
      <div className="container mx-auto px-4 py-8">
        <HrmPageContent />
      </div>
    </>
  );
}
