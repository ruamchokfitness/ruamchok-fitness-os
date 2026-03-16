"use client";

import type { Employee, Leave, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";
import { EmployeeCard } from "./employee-card";

interface EmployeeGridProps {
  employees: Employee[];
  leaves: Leave[];
  quotas: Quota[];
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
}

export function EmployeeGrid({ employees, leaves, quotas, publicHolidays, customHolidays }: EmployeeGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {employees.map((employee) => {
        const employeeLeaves = leaves.filter((l) => l.employeeId === employee.id);
        const employeeQuota = quotas.find((q) => q.employeeId === employee.id);

        return (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            leaves={employeeLeaves}
            quota={employeeQuota}
            publicHolidays={publicHolidays}
            customHolidays={customHolidays}
          />
        );
      })}
    </div>
  );
}
