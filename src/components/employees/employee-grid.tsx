"use client";

import { useMemoFirebase } from '@/firebase';
import type { Employee, Leave, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";
import { EmployeeCard } from "./employee-card";
import { useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';

export function EmployeeGrid() {
  const { firestore } = useFirebase();

  const employeesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "employees")) : null, [firestore]);
  const leavesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "leaves")) : null, [firestore]);
  const quotasQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "quotas")) : null, [firestore]);
  const publicHolidaysQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "publicHolidays")) : null, [firestore]);
  const customHolidaysQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "customHolidays")) : null, [firestore]);

  const { data: employees, isLoading: loadingEmployees } = useCollection<Employee>(employeesQuery);
  const { data: leaves, isLoading: loadingLeaves } = useCollection<Leave>(leavesQuery);
  const { data: quotas, isLoading: loadingQuotas } = useCollection<Quota>(quotasQuery);
  const { data: publicHolidays, isLoading: loadingPublicHolidays } = useCollection<PublicHoliday>(publicHolidaysQuery);
  const { data: customHolidays, isLoading: loadingCustomHolidays } = useCollection<CustomHoliday>(customHolidaysQuery);

  const isLoading = loadingEmployees || loadingLeaves || loadingQuotas || loadingPublicHolidays || loadingCustomHolidays;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  
  if (!employees) return (
    <div className="text-center py-8 text-gray-500">
      <p>ยังไม่มีพนักงานในระบบ</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {employees.map((employee) => {
        const employeeLeaves = (leaves || []).filter((l) => l.employeeId === employee.id);
        const employeeQuota = (quotas || []).find((q) => q.employeeId === employee.id);

        return (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            leaves={employeeLeaves}
            quota={employeeQuota}
            publicHolidays={publicHolidays || []}
            customHolidays={customHolidays || []}
          />
        );
      })}
    </div>
  );
}
