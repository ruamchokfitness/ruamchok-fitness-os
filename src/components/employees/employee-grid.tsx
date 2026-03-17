"use client";

import { useMemo } from 'react';
import type { Employee, Leave, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";
import { EmployeeCard } from "./employee-card";
import { useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { Loader2 } from 'lucide-react';

interface EmployeeGridProps {
  employees: Employee[];
  leaves: Leave[];
  quotas: Quota[];
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
}

export function EmployeeGrid({ 
    employees: initialEmployees, 
    leaves: initialLeaves, 
    quotas: initialQuotas, 
    publicHolidays: initialPublicHolidays,
    customHolidays: initialCustomHolidays
}: EmployeeGridProps) {
  const { firestore } = useFirebase();

  const employeesQuery = useMemo(() => firestore ? query(collection(firestore, "employees")) : null, [firestore]);
  const leavesQuery = useMemo(() => firestore ? query(collection(firestore, "leaves")) : null, [firestore]);
  const quotasQuery = useMemo(() => firestore ? query(collection(firestore, "quotas")) : null, [firestore]);
  const publicHolidaysQuery = useMemo(() => firestore ? query(collection(firestore, "publicHolidays")) : null, [firestore]);
  const customHolidaysQuery = useMemo(() => firestore ? query(collection(firestore, "customHolidays")) : null, [firestore]);

  const { data: employees, isLoading: loadingEmployees } = useCollection<Employee>(employeesQuery);
  const { data: leaves, isLoading: loadingLeaves } = useCollection<Leave>(leavesQuery);
  const { data: quotas, isLoading: loadingQuotas } = useCollection<Quota>(quotasQuery);
  const { data: publicHolidays, isLoading: loadingPublicHolidays } = useCollection<PublicHoliday>(publicHolidaysQuery);
  const { data: customHolidays, isLoading: loadingCustomHolidays } = useCollection<CustomHoliday>(customHolidaysQuery);

  const isLoading = loadingEmployees || loadingLeaves || loadingQuotas || loadingPublicHolidays || loadingCustomHolidays;
  
  const finalEmployees = employees ?? initialEmployees;
  const finalLeaves = leaves ?? initialLeaves;
  const finalQuotas = quotas ?? initialQuotas;
  const finalPublicHolidays = publicHolidays ?? initialPublicHolidays;
  const finalCustomHolidays = customHolidays ?? initialCustomHolidays;


  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {finalEmployees.map((employee) => {
        const employeeLeaves = finalLeaves.filter((l) => l.employeeId === employee.id);
        const employeeQuota = finalQuotas.find((q) => q.employeeId === employee.id);

        return (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            leaves={employeeLeaves}
            quota={employeeQuota}
            publicHolidays={finalPublicHolidays}
            customHolidays={finalCustomHolidays}
          />
        );
      })}
    </div>
  );
}
