"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { VacationTier } from "@/lib/types";
import { useState, useTransition } from "react";
import { Input } from "../ui/input";
import { useToast } from "@/hooks/use-toast";
import { Edit, Loader2 } from "lucide-react";
import { useFirebase } from "@/firebase/provider";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc } from "firebase/firestore";

interface VacationEntitlementTableProps {
  tiers: VacationTier[];
}

export function VacationEntitlementTable({ tiers }: VacationEntitlementTableProps) {
  return (
    <div>
      <h4 className="text-md font-semibold text-gray-800 mb-3">ตารางสิทธิ์ลาพักร้อนตามอายุงาน</h4>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ทำงานครบ(ปี)</TableHead>
                <TableHead>สิทธิ์ลาพักร้อน</TableHead>
                <TableHead className="text-center w-[80px]">แก้ไข</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <EditableTierRow key={tier.id} tier={tier} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EditableTierRow({ tier }: { tier: VacationTier }) {
  const { firestore } = useFirebase();
  const [isEditing, setIsEditing] = useState(false);
  const [years, setYears] = useState(tier.years);
  const [days, setDays] = useState(tier.days);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSave = () => {
    if ((years === tier.years && days === tier.days) || !firestore) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const tierRef = doc(firestore, "vacationTiers", tier.id);
      setDocumentNonBlocking(tierRef, { years, days }, { merge: true });
      toast({
        title: "อัปเดตสำเร็จ",
        className: "bg-accent text-accent-foreground",
      });
      setIsEditing(false);
    });
  };

  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="font-medium text-sm">
        {isEditing ? (
          <Input value={years} onChange={(e) => setYears(e.target.value)} className="h-8" />
        ) : (
          years
        )}
      </TableCell>
      <TableCell className="font-medium text-sm">
        {isEditing ? (
          <Input value={days} onChange={(e) => setDays(e.target.value)} className="h-8" />
        ) : (
          days
        )}
      </TableCell>
      <TableCell className="text-center">
        <Button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          size="sm"
          variant="ghost"
          className="bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 h-7"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <Edit className="w-3 h-3 mr-1" />
              {isEditing ? 'บันทึก' : 'แก้ไข'}
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}
