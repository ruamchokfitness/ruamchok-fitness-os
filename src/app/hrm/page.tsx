import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeGrid } from "@/components/employees/employee-grid";
import { PolicyFooter } from "@/components/policies/policy-footer";
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog";

import {
  getEmployees,
  getLeaves,
  getQuotas,
  getPolicies,
  getVacationTiers,
  getPublicHolidays,
  getCustomHolidays,
} from "@/lib/data";

export default async function HrmPage() {
  const [
    employees,
    leaves,
    quotas,
    policies,
    vacationTiers,
    publicHolidays,
    customHolidays,
  ] = await Promise.all([
    getEmployees(),
    getLeaves(),
    getQuotas(),
    getPolicies(),
    getVacationTiers(),
    getPublicHolidays(),
    getCustomHolidays(),
  ]);

  return (
    <>
      <header className="bg-slate-900 text-white py-4 md:py-6">
        <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">RCF HRM</h1>
            <p className="text-slate-300 text-sm md:text-base">Employee leave management system.</p>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-8">
          <AddEmployeeDialog>
            <Button className="transition-transform hover:scale-105">
              <UserPlus className="mr-2 h-5 w-5" />
              เพิ่มพนักงาน
            </Button>
          </AddEmployeeDialog>
        </div>
        <main className="mb-12">
          <EmployeeGrid
            employees={employees}
            leaves={leaves}
            quotas={quotas}
            publicHolidays={publicHolidays}
            customHolidays={customHolidays}
          />
        </main>
        <PolicyFooter
          policies={policies}
          vacationTiers={vacationTiers}
          publicHolidays={publicHolidays}
          customHolidays={customHolidays}
        />
      </div>
    </>
  );
}
