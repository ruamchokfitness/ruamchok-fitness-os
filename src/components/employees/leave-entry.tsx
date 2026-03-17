"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Leave } from "@/lib/types";
import { Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useFirebase } from "@/firebase/provider";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc } from "firebase/firestore";

interface LeaveEntryProps {
  leave: Leave;
  onEdit: (leave: Leave) => void;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  });
}

export function LeaveEntry({ leave, onEdit }: LeaveEntryProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    if (!firestore) return;
    const leaveRef = doc(firestore, "leaves", leave.id);
    deleteDocumentNonBlocking(leaveRef);
    toast({
      title: "ลบข้อมูลสำเร็จ",
      description: "ข้อมูลการลาถูกลบแล้ว",
      className: "bg-accent text-accent-foreground",
    });
  };

  return (
    <>
      <div className="bg-secondary/50 p-2 rounded-md border-l-4 border-primary/50 transition-all duration-200 ease-in-out hover:border-primary hover:bg-secondary/80">
        <div className="flex justify-between items-center">
            <div>
                <div className="text-xs text-muted-foreground">{formatDate(leave.date)}</div>
                <div className="font-medium text-xs text-foreground truncate max-w-[120px]">{leave.type}</div>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">{leave.days} วัน</span>
                <div className="flex">
                    <Button onClick={() => onEdit(leave)} variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                        <Edit className="h-3 w-3" />
                    </Button>
                    <Button onClick={() => setConfirmOpen(true)} variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
      </div>
      <ConfirmationDialog
        open={isConfirmOpen}
        onOpenChange={setConfirmOpen}
        title="ยืนยันการลบ"
        description={`คุณต้องการลบข้อมูลการลา "${leave.type}" วันที่ ${formatDate(leave.date)} จำนวน ${leave.days} วัน หรือไม่?`}
        onConfirm={handleDelete}
      />
    </>
  );
}
