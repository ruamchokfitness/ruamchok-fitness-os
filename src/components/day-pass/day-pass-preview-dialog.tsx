'use client';

import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DayPassVoucher } from './day-pass-voucher';
import { exportVoucherToPdf } from '@/lib/day-pass-pdf';
import type { DayPassTicket } from '@/lib/types';
import { Download, Printer, Loader2, CheckCircle2, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DayPassPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: DayPassTicket | null;
  autoDownloadOnOpen?: boolean;
}

export function DayPassPreviewDialog({
  open,
  onOpenChange,
  ticket,
}: DayPassPreviewDialogProps) {
  const voucherRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  if (!ticket) return null;

  const handleDownloadPdf = async () => {
    if (!voucherRef.current) return;
    setIsExporting(true);
    try {
      await exportVoucherToPdf(
        voucherRef.current,
        ticket.ticket_no,
        ticket.client_name,
        ticket.date
      );
      toast({
        title: 'ดาวน์โหลดสำเร็จ',
        description: `ไฟล์คูปอง ${ticket.ticket_no} ถูกบันทึกเรียบร้อยแล้ว`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-5xl max-h-[92vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader className="print:hidden pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <DialogTitle className="text-xl font-bold">
                  คูปอง Day Pass No. {ticket.ticket_no}
                </DialogTitle>
                <DialogDescription>
                  ลูกค้า: {ticket.client_name} ({ticket.phone || 'ไม่ระบุเบอร์โทร'}) | แพ็กเกจ: {ticket.package_type} (฿{ticket.price})
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://drive.google.com/drive/folders/1CHwB12PBX0rBT0nQGYbg2MTlwAZq48xp?usp=drive_link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                >
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  เปิด Google Drive
                </Button>
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 border-slate-300 text-slate-700"
              >
                <Printer className="w-4 h-4" />
                พิมพ์ (Print)
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังสร้าง PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    ดาวน์โหลด PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Voucher Container for PDF and Print */}
        <div className="py-4 overflow-x-auto flex justify-center bg-slate-100/60 p-3 rounded-lg">
          <DayPassVoucher ref={voucherRef} ticket={ticket} id="day-pass-print-area" />
        </div>

        <DialogFooter className="print:hidden pt-2 border-t flex sm:justify-between items-center">
          <span className="text-xs text-muted-foreground">
            💡 นำไฟล์ PDF ที่ดาวน์โหลดไปเก็บไว้ในโฟลเดอร์ Google Drive ได้ทันที
          </span>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            ปิดหน้าต่าง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
