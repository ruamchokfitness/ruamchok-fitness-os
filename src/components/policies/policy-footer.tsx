import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PolicyNotes } from "./policy-notes";
import { VacationEntitlementTable } from "./vacation-entitlement-table";
import { PublicHolidays } from "./public-holidays";
import type { Policy, VacationTier, PublicHoliday, CustomHoliday } from "@/lib/types";

interface PolicyFooterProps {
  policies: Policy[];
  vacationTiers: VacationTier[];
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
}

export function PolicyFooter({ policies, vacationTiers, publicHolidays, customHolidays }: PolicyFooterProps) {
  return (
    <footer className="mt-12">
      <Card>
        <CardContent className="p-6 space-y-6">
          <PolicyNotes policies={policies} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VacationEntitlementTable tiers={vacationTiers} />
            <PublicHolidays publicHolidays={publicHolidays} customHolidays={customHolidays} />
          </div>
        </CardContent>
      </Card>
    </footer>
  );
}
