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
import type { Employee, Leave, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";
import { Loader2, Save, X } from "lucide-react";
import { useFirebase } from "@/firebase/provider";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc, getDocs, query, where, collection } from "firebase/firestore";

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
  const { firestore } = useFirebase();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [leaveType, setLeaveType] = useState(leaveToEdit?.type || "");

  const allHolidays = [...publicHolidays, ...customHolidays].map(h => h.name);
  const isHoliday = allHolidays.includes(leaveType);
  const isBirthday = leaveType === "วันเกิด";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const leaveId = leaveToEdit?.id || `leave${Date.now()}`;
    const leaveData: Leave = {
      id: leaveId,
      employeeId: employee.id,
      date: formData.get("date") as string,
      type: formData.get("type") as string,
      days: Number(formData.get("days")),
    };

    startTransition(async () => {
      // --- Validation ---
      const leavesQuery = query(collection(firestore, "leaves"), where("employeeId", "==", employee.id));
      const leavesSnapshot = await getDocs(leavesQuery);
      let currentLeaves: Leave[] = leavesSnapshot.docs.map(doc => doc.data() as Leave);

      if (leaveToEdit) {
        currentLeaves = currentLeaves.filter(l => l.id !== leaveToEdit.id);
      }

      if (!quota) {
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่พบข้อมูลโควต้าของพนักงาน", variant: "destructive" });
        return;
      }
       if(leaveData.type === "พักร้อน") {
        const used = currentLeaves.filter(l => l.type === "พักร้อน").reduce((sum, l) => sum + l.days, 0);
        if(used + leaveData.days > quota.vacation) {
            toast({ title: "สิทธิ์ไม่เพียงพอ", description: `สิทธิ์พักร้อนไม่เพียงพอ คงเหลือ ${quota.vacation - used} วัน`, variant: "destructive" });
            return;
        }
      } else if (leaveData.type === "วันเกิด") {
        const used = currentLeaves.filter(l => l.type === "วันเกิด").reduce((sum, l) => sum + l.days, 0);
        if(used + leaveData.days > quota.birthday) {
            toast({ title: "สิทธิ์ไม่เพียงพอ", description: `สิทธิ์วันเกิดไม่เพียงพอ คงเหลือ ${quota.birthday - used} วัน`, variant: "destructive" });
            return;
        }
      } else if (allHolidays.includes(leaveData.type)) {
        const used = currentLeaves.filter(l => allHolidays.includes(l.type)).reduce((sum, l) => sum + l.days, 0);
        if(used + leaveData.days > quota.holiday) {
            toast({ title: "สิทธิ์ไม่เพียงพอ", description: `สิทธิ์วันหยุดนักขัตฤกษ์ไม่เพียงพอ คงเหลือ ${quota.holiday - used} วัน`, variant: "destructive" });
            return;
        }
        const alreadyTaken = currentLeaves.find(l => l.type === leaveData.type);
        if (alreadyTaken && (alreadyTaken.days + leaveData.days > 1)) {
            toast({ title: "เกิดข้อผิดพลาด", description: `ไม่สามารถใช้วันหยุด ${leaveData.type} ซ้ำได้`, variant: "destructive" });
            return;
        }
      }

      // --- Save Data ---
      const leaveRef = doc(firestore, "leaves", leaveId);
      setDocumentNonBlocking(leaveRef, leaveData, { merge: true });
      
      toast({
        title: "บันทึกสำเร็จ",
        description: "ข้อมูลการลาได้รับการบันทึกแล้ว",
        className: "bg-accent text-accent-foreground",
      });
      onOpenChange(false);
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
        <form onSubmit={handleSubmit}>
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
