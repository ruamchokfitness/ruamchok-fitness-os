'use client';
import { UserPlus, Users, Loader2, FileText, Clock, CalendarClock, FileArchive } from "lucide-react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { EmployeeGrid } from "@/components/employees/employee-grid";
import { PolicyFooter } from "@/components/policies/policy-footer";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, writeBatch, doc, getDocs, limit } from 'firebase/firestore';
import type { Employee, Quota, Policy, VacationTier, PublicHoliday, User } from "@/lib/types";
import { useEffect, useState } from "react";


function HrmHeader() {
    const { firestore } = useFirebase();
    const policiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "policies")) : null, [firestore]);
    const { data: policies } = useCollection<Policy>(policiesQuery);
    const systemTitle = policies?.find(p => p.key === 'system_title')?.value || 'RCF HRM';

    return (
        <header className="bg-slate-900 text-white py-4 md:py-6">
            <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">{systemTitle}</h1>
                <p className="text-slate-300 text-sm md:text-base">Employee leave management system.</p>
            </div>
            </div>
        </header>
    )
}

// This is the seeding logic moved from src/lib/data.ts
const seedInitialData = async (firestore: any) => {
    const employeesCollectionRef = collection(firestore, "employees");
    const employeesSnapshot = await getDocs(query(employeesCollectionRef, limit(1)));
    if (employeesSnapshot.empty) {
        console.log("No employees found. Seeding initial data...");
        const batch = writeBatch(firestore);

        const initialEmployees: Employee[] = [
          { id: 'emp1', name: 'ประเทศ โสมานัส' },
          { id: 'emp2', name: 'สมชาย เข็มกลัด' },
        ];
        
        const initialQuotas: Quota[] = [
          { employeeId: 'emp1', vacation: 6, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน'] },
          { employeeId: 'emp2', vacation: 8, holiday: 8, birthday: 1, holidayPermissions: ['วันแม่', 'วันพ่อ', 'วันแรงงาน', 'วันปิยะมหาราช'] },
        ];

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

        initialEmployees.forEach(e => batch.set(doc(collection(firestore, "employees"), e.id), e));
        initialQuotas.forEach(q => batch.set(doc(collection(firestore, "quotas"), q.employeeId), q));
        initialPolicies.forEach(p => batch.set(doc(collection(firestore, "policies"), p.key), p));
        initialVacationTiers.forEach(vt => batch.set(doc(collection(firestore, "vacationTiers"), vt.id), vt));
        initialPublicHolidays.forEach(ph => batch.set(doc(collection(firestore, "publicHolidays"), ph.id), ph));
        
        await batch.commit();
        console.log("Initial data seeded successfully.");
    }
}


function HrmPageContent() {
    const { firestore } = useFirebase();
    const [seeding, setSeeding] = useState(true);

    useEffect(() => {
        if (firestore) {
            seedInitialData(firestore).finally(() => setSeeding(false));
        }
    }, [firestore]);

    if (seeding) {
        return (
            <div className="flex h-[calc(100vh-150px)] w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-8 p-4 bg-card rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <Link href="https://www.jotform.com/sign/250938573129061/invite/01js96gv8r393cf244acf323f8" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                            <FileText className="mr-3 text-blue-500" />
                            <div>
                                <p className="font-semibold">ใบลา</p>
                                <p className="text-xs text-muted-foreground">Leave Form</p>
                            </div>
                        </Button>
                    </Link>
                     <Link href="https://www.jotform.com/sign/251001899741054/invite/01jsxk2pwn8d091da3f941ed76" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                            <Clock className="mr-3 text-orange-500" />
                            <div>
                                <p className="font-semibold">ใบทำงานล่วงเวลา</p>
                                <p className="text-xs text-muted-foreground">Overtime Form</p>
                            </div>
                        </Button>
                    </Link>
                    <Link href="https://www.jotform.com/sign/250951687461061/invite/01jwqs11ag5a2110789807e5f1" target="_blank" rel="noopener noreferrer">
                         <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                            <CalendarClock className="mr-3 text-green-500" />
                            <div>
                                <p className="font-semibold">ใบลงเวลาทำงาน</p>
                                <p className="text-xs text-muted-foreground">Timesheet Form</p>
                            </div>
                        </Button>
                    </Link>
                    <Link href="https://www.jotform.com/sign/252451871554056/invite/01k47cqbwc34d76b08e21c77d6" target="_blank" rel="noopener noreferrer">
                         <Button variant="outline" className="w-full justify-start text-left h-auto py-3">
                            <FileArchive className="mr-3 text-purple-500" />
                             <div>
                                <p className="font-semibold">ใบขอเอกสาร</p>
                                <p className="text-xs text-muted-foreground">Document Request</p>
                            </div>
                        </Button>
                    </Link>
                </div>
            </div>
            <div className="flex justify-end mb-8">
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
