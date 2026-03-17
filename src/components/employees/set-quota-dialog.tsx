"use client";

import { useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";
import { Loader2, Save, X } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { useFirebase } from "@/firebase/provider";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc } from "firebase/firestore";

interface SetQuotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  quota?: Quota;
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
}

export function SetQuotaDialog({
  open,
  onOpenChange,
  employee,
  quota,
  publicHolidays,
  customHolidays
}: SetQuotaDialogProps) {
  const { firestore } = useFirebase();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const allHolidays = [...publicHolidays, ...customHolidays];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const permissions = formData.getAll("permissions") as string[];

    const newQuota: Quota = {
      employeeId: employee.id,
      vacation: Number(formData.get("vacation")),
      holiday: Number(formData.get("holiday")),
      birthday: Number(formData.get("birthday")),
      holidayPermissions: permissions,
    };

    startTransition(async () => {
      const quotaRef = doc(firestore, "quotas", employee.id);
      setDocumentNonBlocking(quotaRef, newQuota, { merge: true });
      toast({
        title: "บันทึกสำเร็จ",
        description: `อัปเดตสิทธิ์การลาของ ${employee.name} แล้ว`,
        className: "bg-accent text-accent-foreground",
      });
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>กำหนดสิทธิ์การลา: {employee.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <Label htmlFor="vacation-quota">พักร้อน (วัน)</Label>
                    <Input id="vacation-quota" name="vacation" type="number" min="0" step="0.5" defaultValue={quota?.vacation || 0} required />
                </div>
                <div>
                    <Label htmlFor="holiday-quota">นักขัตฤกษ์ (วัน)</Label>
                    <Input id="holiday-quota" name="holiday" type="number" min="0" step="0.5" defaultValue={quota?.holiday || 0} required />
                </div>
                <div>
                    <Label htmlFor="birthday-quota">วันเกิด (วัน)</Label>
                    <Input id="birthday-quota" name="birthday" type="number" min="0" step="0.5" defaultValue={quota?.birthday || 0} required />
                </div>
            </div>
            <div>
              <Label className="mb-2 block">เลือกวันนักขัตฤกษ์ที่สามารถใช้ได้</Label>
              <ScrollArea className="h-48 rounded-md border bg-secondary/30 p-4">
                <div className="space-y-2">
                  {allHolidays.map((holiday) => (
                    <div key={holiday.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${holiday.id}`}
                        name="permissions"
                        value={holiday.name}
                        defaultChecked={quota?.holidayPermissions.includes(holiday.name)}
                      />
                      <label htmlFor={`perm-${holiday.id}`} className="text-sm">
                        {holiday.name}
                        {holiday.hasOwnProperty('date') && ` (${(holiday as PublicHoliday).date})`}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-gray-500 mt-2">*เลือกเฉพาะวันที่พนักงานคนนี้สามารถใช้สิทธิ์ได้</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />ยกเลิก</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
