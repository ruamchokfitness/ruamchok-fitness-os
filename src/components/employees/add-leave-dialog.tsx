"use client";

import { useState, useTransition, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addOrUpdateLeave } from "@/lib/actions";
import type { Employee, Leave, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";
import { Loader2, Save, X } from "lucide-react";

interface AddLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  quota?: Quota;
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
  leaveToEdit?: Leave;
}

export function AddLeaveDialog({
  open,
  onOpenChange,
  employee,
  quota,
  publicHolidays,
  customHolidays,
  leaveToEdit,
}: AddLeaveDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [leaveType, setLeaveType] = useState(leaveToEdit?.type || "");

  const allHolidays = [...publicHolidays, ...customHolidays].map(h => h.name);
  const isHoliday = allHolidays.includes(leaveType);
  const isBirthday = leaveType === "วันเกิด";

  const handleSubmit = (formData: FormData) => {
    formData.append("employeeId", employee.id);
    if (leaveToEdit) {
      formData.append("leaveId", leaveToEdit.id);
    }

    startTransition(async () => {
      const result = await addOrUpdateLeave(formData);
      if (result.success) {
        toast({
          title: "บันทึกสำเร็จ",
          description: "ข้อมูลการลาได้รับการบันทึกแล้ว",
          className: "bg-accent text-accent-foreground",
        });
        onOpenChange(false);
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: result.message || "ไม่สามารถบันทึกข้อมูลได้",
          variant: "destructive",
        });
      }
    });
  };

  useEffect(() => {
    if (open) {
      setLeaveType(leaveToEdit?.type || "");
    }
  }, [open, leaveToEdit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{leaveToEdit ? 'แก้ไขข้อมูลการลา' : 'เพิ่มข้อมูลการลา'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
              <Label>พนักงาน</Label>
              <div className="text-lg font-semibold text-primary">{employee.name}</div>
            </div>
            
            <div>
              <Label htmlFor="leave-date">วันที่หยุด</Label>
              <Input id="leave-date" name="date" type="date" defaultValue={leaveToEdit?.date || new Date().toISOString().split('T')[0]} required />
            </div>

            <div>
              <Label htmlFor="leave-type">สิทธิ์ที่ใช้</Label>
              <Select name="type" required onValueChange={setLeaveType} defaultValue={leaveToEdit?.type}>
                <SelectTrigger id="leave-type">
                  <SelectValue placeholder="เลือกประเภทการลา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="พักร้อน">พักร้อน</SelectItem>
                  <SelectItem value="วันเกิด">วันเกิด</SelectItem>
                  {publicHolidays.map((h) => (
                     quota?.holidayPermissions.includes(h.name) && <SelectItem key={h.id} value={h.name}>นักขัตฤกษ์ - {h.name}</SelectItem>
                  ))}
                  {customHolidays.map((h) => (
                    quota?.holidayPermissions.includes(h.name) && <SelectItem key={h.id} value={h.name}>อื่นๆ - {h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="leave-days">จำนวนวันที่หยุด</Label>
              <Input
                id="leave-days"
                name="days"
                type="number"
                step="0.5"
                min="0.5"
                max={isHoliday || isBirthday ? 1 : undefined}
                placeholder="1"
                defaultValue={leaveToEdit?.days || 1}
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                <X className="mr-2 h-4 w-4" />
                ยกเลิก
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {leaveToEdit ? 'บันทึกการเปลี่ยนแปลง' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
