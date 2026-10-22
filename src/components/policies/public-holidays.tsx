"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { PublicHoliday, CustomHoliday } from "@/lib/types";
import { Trash2 } from "lucide-react";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useState } from "react";
import { AddCustomHolidayDialog } from "./add-custom-holiday-dialog";
import { EditableTextItem } from "./editable-text-item";
import { useFirebase } from "@/firebase/provider";
import { deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc } from "firebase/firestore";

interface PublicHolidaysProps {
  publicHolidays: PublicHoliday[];
  customHolidays: CustomHoliday[];
}

export function PublicHolidays({ publicHolidays, customHolidays }: PublicHolidaysProps) {
  return (
    <div>
      <h4 className="text-md font-semibold text-gray-800 mb-3">สิทธิ์วันหยุดนักขัตฤกษ์ที่ใช้ได้</h4>
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3 text-sm">
            {publicHolidays.map((holiday) => (
              <EditableTextItem
                key={holiday.id}
                itemKey={holiday.id}
                initialValue={holiday.date}
                label={holiday.name}
                collectionName="publicHolidays"
                className="py-2 px-3 items-center"
              >
                  <span className="font-medium">{holiday.name}:</span>
              </EditableTextItem>
            ))}
            <div className="pt-3 border-t">
              <h5 className="text-xs font-semibold text-gray-600 mb-2">วันหยุดพิเศษเพิ่มเติม</h5>
              <div className="space-y-2 mb-2">
                {customHolidays.length > 0 ? (
                  customHolidays.map((holiday) => (
                    <CustomHolidayItem key={holiday.id} holiday={holiday} />
                  ))
                ) : (
                  <p className="text-xs text-gray-500 italic px-3">ยังไม่มีวันหยุดพิเศษ</p>
                )}
              </div>
              <AddCustomHolidayDialog />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomHolidayItem({ holiday }: { holiday: CustomHoliday }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    if(!firestore) return;
    const holidayRef = doc(firestore, "customHolidays", holiday.id);
    deleteDocumentNonBlocking(holidayRef);
    toast({
      title: "ลบสำเร็จ",
      description: `ลบวันหยุด "${holiday.name}" แล้ว`,
      className: "bg-accent text-accent-foreground",
    });
  };

  return (
    <>
      <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
        <span className="font-medium text-sm">{holiday.name}</span>
        <Button onClick={() => setConfirmOpen(true)} size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <ConfirmationDialog
        open={isConfirmOpen}
        onOpenChange={setConfirmOpen}
        title="ยืนยันการลบ"
        description={`คุณต้องการลบวันหยุดพิเศษ "${holiday.name}" หรือไม่?`}
        onConfirm={handleDelete}
      />
    </>
  );
}
