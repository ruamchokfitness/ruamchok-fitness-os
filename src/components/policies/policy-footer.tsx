"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PolicyNotes } from "./policy-notes";
import { VacationEntitlementTable } from "./vacation-entitlement-table";
import { PublicHolidays } from "./public-holidays";
import type { Policy, VacationTier, PublicHoliday, CustomHoliday } from "@/lib/types";
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";

export function PolicyFooter() {
  const { firestore } = useFirebase();

  const policiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "policies")) : null, [firestore]);
  const vacationTiersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "vacationTiers")) : null, [firestore]);
  const publicHolidaysQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "publicHolidays")) : null, [firestore]);
  const customHolidaysQuery = useMemoFirebase(() => firestore ? query(collection(firestore, "customHolidays")) : null, [firestore]);

  const { data: policies, isLoading: l1 } = useCollection<Policy>(policiesQuery);
  const { data: vacationTiers, isLoading: l2 } = useCollection<VacationTier>(vacationTiersQuery);
  const { data: publicHolidays, isLoading: l3 } = useCollection<PublicHoliday>(publicHolidaysQuery);
  const { data: customHolidays, isLoading: l4 } = useCollection<CustomHoliday>(customHolidaysQuery);

  const isLoading = l1 || l2 || l3 || l4;

  if (isLoading) {
    return (
      <footer className="mt-12">
        <Card>
          <CardContent className="p-6 space-y-6">
            <Skeleton className="h-8 w-1/4 mb-3" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </CardContent>
        </Card>
      </footer>
    );
  }

  return (
    <footer className="mt-12">
      <Card>
        <CardContent className="p-6 space-y-6">
          <PolicyNotes policies={policies || []} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VacationEntitlementTable tiers={vacationTiers || []} />
            <PublicHolidays publicHolidays={publicHolidays || []} customHolidays={customHolidays || []} />
          </div>
        </CardContent>
      </Card>
    </footer>
  );
}
