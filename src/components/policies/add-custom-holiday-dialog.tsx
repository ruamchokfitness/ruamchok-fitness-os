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
import { addCustomHoliday } from "@/lib/actions";
import { Loader2, Plus, X } from "lucide-react";

export function AddCustomHolidayDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณากรอกชื่อวันหยุด",
        variant: "destructive",
      });
      return;
    }
    startTransition(async () => {
      const result = await addCustomHoliday(name);
      if (result.success) {
        toast({
          title: "เพิ่มวันหยุดสำเร็จ",
          description: `วันหยุด "${name}" ถูกเพิ่มในระบบแล้ว`,
          className: "bg-accent text-accent-foreground",
        });
        setOpen(false);
        setName("");
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถเพิ่มวันหยุดได้",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-800 border-purple-200">
            <Plus className="w-3 h-3 mr-2" />
            เพิ่มสิทธิ์วันหยุดอื่นๆ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>เพิ่มวันหยุดพิเศษ</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="custom-holiday-name" className="text-right">
                ชื่อวันหยุด
              </Label>
              <Input
                id="custom-holiday-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น วันศุกร์ที่ 13"
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />ยกเลิก</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending} className="bg-purple-600 hover:bg-purple-700">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              เพิ่มเติม
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
