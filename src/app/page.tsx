import { UserPlus } from "lucide-react";
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

export default async function Home() {
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

  const title = policies.find((p) => p.key === "system_title")?.value || "RuamChok Fitness HRM";

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-headline">{title}</h1>
        <AddEmployeeDialog>
          <Button className="mt-4 transition-transform hover:scale-105">
            <UserPlus className="mr-2 h-5 w-5" />
            เพิ่มพนักงาน
          </Button>
        </AddEmployeeDialog>
      </header>
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
  );
}
