"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, X } from "lucide-react";
import { useFirebase } from "@/firebase/provider";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc, collection } from "firebase/firestore";

export function AddEmployeeDialog({ children }: { children: React.ReactNode }) {
  const { firestore } = useFirebase();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !firestore) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณากรอกชื่อพนักงาน",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const employeeId = `emp${Date.now()}`;
      const employeeRef = doc(firestore, "employees", employeeId);
      const quotaRef = doc(firestore, "quotas", employeeId);

      try {
        setDocumentNonBlocking(employeeRef, { id: employeeId, name: name.trim() }, {});
        setDocumentNonBlocking(quotaRef, { employeeId, vacation: 0, holiday: 0, birthday: 0, holidayPermissions: [] }, {});
        
        toast({
          title: "เพิ่มพนักงานสำเร็จ",
          description: `พนักงาน "${name}" ถูกเพิ่มในระบบแล้ว`,
          className: "bg-accent text-accent-foreground",
        });
        setOpen(false);
        setName("");
      } catch (error) {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถเพิ่มพนักงานได้ กรุณาลองใหม่อีกครั้ง",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>เพิ่มพนักงานใหม่</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-employee-name" className="text-right">
                ชื่อพนักงาน
              </Label>
              <Input
                id="new-employee-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น นายประเทศ โสมานัส"
                className="col-span-3"
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
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              เพิ่มพนักงาน
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
