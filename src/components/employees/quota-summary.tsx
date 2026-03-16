"use client";

import { useMemo } from "react";
import type { Leave, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";

interface QuotaSummaryProps {
  employeeId: string;
  leaves: Leave[];
  quota?: Quota;
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
}

const QuotaItem = ({ label, remaining, total }: { label: string, remaining: number, total: number }) => (
  <div className="flex justify-between items-center">
    <span className="text-xs text-gray-600">{label}:</span>
    <div className="text-right">
      <span className="font-semibold text-sm text-sky-700">{remaining}</span>
      <span className="text-gray-400 text-xs">/{total}</span>
    </div>
  </div>
);

export function QuotaSummary({ employeeId, leaves, quota, publicHolidays, customHolidays }: QuotaSummaryProps) {
  const { usedVacation, usedHoliday, usedBirthday, holidayBreakdown } = useMemo(() => {
    const allHolidayNames = [...publicHolidays.map(h => h.name), ...customHolidays.map(h => h.name)];

    const usedVacation = leaves.filter(l => l.type === "พักร้อน").reduce((sum, l) => sum + l.days, 0);
    const usedHoliday = leaves.filter(l => allHolidayNames.includes(l.type)).reduce((sum, l) => sum + l.days, 0);
    const usedBirthday = leaves.filter(l => l.type === "วันเกิด").reduce((sum, l) => sum + l.days, 0);

    const holidayBreakdown = quota?.holidayPermissions
        .map(permission => {
            const usedDays = leaves.filter(l => l.type === permission).reduce((sum, l) => sum + l.days, 0);
            const remaining = 1 - usedDays;
            if (remaining > 0) {
                return `${permission.replace('วัน','').trim().substring(0, 7)} ${remaining}`;
            }
            return null;
        })
        .filter(Boolean)
        .join(', ');

    return { usedVacation, usedHoliday, usedBirthday, holidayBreakdown };
  }, [leaves, quota, publicHolidays, customHolidays]);

  const remainingVacation = Math.max(0, (quota?.vacation || 0) - usedVacation);
  const remainingHoliday = Math.max(0, (quota?.holiday || 0) - usedHoliday);
  const remainingBirthday = Math.max(0, (quota?.birthday || 0) - usedBirthday);

  return (
    <div className="rounded-lg p-2 mb-2 bg-gradient-to-br from-sky-50 to-blue-100 border border-sky-200">
      <div className="space-y-1">
        <QuotaItem label="พักร้อน" remaining={remainingVacation} total={quota?.vacation || 0} />
        <QuotaItem label="นักขัตฤกษ์" remaining={remainingHoliday} total={quota?.holiday || 0} />
        <QuotaItem label="วันเกิด" remaining={remainingBirthday} total={quota?.birthday || 0} />
      </div>
      {holidayBreakdown && (
        <div className="mt-2 pt-2 border-t border-sky-200">
          <div className="text-xs text-gray-600 mb-1">เหลือวันนักขัตฤกษ์:</div>
          <div className="text-xs text-gray-700 leading-relaxed break-words">
            {holidayBreakdown}
          </div>
        </div>
      )}
    </div>
  );
}
