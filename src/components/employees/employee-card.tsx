"use client";

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Leave, Quota, PublicHoliday, CustomHoliday } from "@/lib/types";
import { Plus, Settings, Loader2, Trash2 } from "lucide-react";
import { QuotaSummary } from "./quota-summary";
import { LeaveEntry } from "./leave-entry";
import { AddLeaveDialog } from "./add-leave-dialog";
import { SetQuotaDialog } from "./set-quota-dialog";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useFirebase } from "@/firebase/provider";
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc, writeBatch, collection, query, where, getDocs } from "firebase/firestore";

interface EmployeeCardProps {
  employee: Employee;
  leaves: Leave[];
  quota?: Quota;
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
}

export function EmployeeCard({ employee, leaves, quota, publicHolidays, customHolidays }: EmployeeCardProps) {
  const { firestore } = useFirebase();
  const [name, setName] = useState(employee.name);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [isLeaveModalOpen, setLeaveModalOpen] = useState(false);
  const [isQuotaModalOpen, setQuotaModalOpen] = useState(false);
  const [leaveToEdit, setLeaveToEdit] = useState<Leave | undefined>(undefined);
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleNameChange = () => {
    if (name === employee.name || !name.trim() || !firestore) {
      setName(employee.name);
      return;
    }
    startTransition(async () => {
      const employeeRef = doc(firestore, "employees", employee.id);
      updateDocumentNonBlocking(employeeRef, { name });
      toast({
        title: "อัปเดตสำเร็จ",
        description: `เปลี่ยนชื่อเป็น "${name}" เรียบร้อย`,
        className: "bg-accent text-accent-foreground",
      });
    });
  };

  const handleDeleteEmployee = async () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);

    const employeeRef = doc(firestore, "employees", employee.id);
    batch.delete(employeeRef);
    
    const leavesQuery = query(collection(firestore, "leaves"), where("employeeId", "==", employee.id));
    const leavesSnapshot = await getDocs(leavesQuery);
    leavesSnapshot.forEach(doc => batch.delete(doc.ref));

    const quotaRef = doc(firestore, "quotas", employee.id);
    batch.delete(quotaRef);

    await batch.commit();

    toast({
      title: "ลบพนักงานสำเร็จ",
      description: `พนักงาน "${employee.name}" ถูกลบออกจากระบบแล้ว`,
      className: "bg-accent text-accent-foreground",
    });
  };

  const handleEditLeave = (leave: Leave) => {
    setLeaveToEdit(leave);
    setLeaveModalOpen(true);
  };
  
  const handleAddLeave = () => {
    setLeaveToEdit(undefined);
    setLeaveModalOpen(true);
  }

  const sortedLeaves = useMemo(() => {
    return [...leaves].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [leaves]);

  return (
    <>
      <Card className="flex flex-col h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1">
        <CardContent className="p-3 flex flex-col flex-grow">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="relative flex-grow">
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameChange}
                onKeyDown={(e) => e.key === 'Enter' && handleNameChange()}
                className="text-sm font-semibold text-gray-800 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-1 py-0 h-8 focus:ring-1 focus:ring-primary w-full"
              />
              {isPending && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center">
              <Button onClick={() => setQuotaModalOpen(true)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                <Settings className="h-4 w-4" />
              </Button>
              <Button onClick={() => setConfirmDeleteOpen(true)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <QuotaSummary employeeId={employee.id} leaves={leaves} quota={quota} publicHolidays={publicHolidays} customHolidays={customHolidays} />
          
          <div className="space-y-1 mb-2 flex-grow min-h-[100px] max-h-48 overflow-y-auto pr-2">
            {sortedLeaves.length > 0 ? (
              sortedLeaves.map((leave) => (
                <LeaveEntry key={leave.id} leave={leave} onEdit={handleEditLeave} />
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">ไม่มีข้อมูลการลา</div>
            )}
          </div>

          <Button onClick={handleAddLeave} className="w-full mt-auto add-button transition-transform hover:scale-105" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            เพิ่มการลา
          </Button>
        </CardContent>
      </Card>

      <AddLeaveDialog
        open={isLeaveModalOpen}
        onOpenChange={setLeaveModalOpen}
        employee={employee}
        quota={quota}
        publicHolidays={publicHolidays}
        customHolidays={customHolidays}
        leaveToEdit={leaveToEdit}
      />
      
      <SetQuotaDialog
        open={isQuotaModalOpen}
        onOpenChange={setQuotaModalOpen}
        employee={employee}
        quota={quota}
        publicHolidays={publicHolidays}
        customHolidays={customHolidays}
      />

      <ConfirmationDialog
        open={isConfirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`ลบพนักงาน ${employee.name}`}
        description="คุณแน่ใจหรือไม่ว่าต้องการลบพนักงานคนนี้? ข้อมูลการลาและโควต้าทั้งหมดจะถูกลบไปด้วยและไม่สามารถกู้คืนได้"
        onConfirm={handleDeleteEmployee}
      />
    </>
  );
}
