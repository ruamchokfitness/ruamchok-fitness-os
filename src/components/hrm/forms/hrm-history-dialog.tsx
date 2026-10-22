'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { HrmEFormSubmission, HrmFormType } from '@/lib/hrm-forms-types';
import { HRM_FORM_CONFIGS } from '@/lib/hrm-forms-types';
import { HrmEFormVoucher } from './hrm-eform-voucher';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Search,
  Loader2,
  Eye,
  Download,
  Printer,
  Calendar,
  FileText,
  Clock,
  CalendarClock,
  FileArchive,
  UserMinus,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HrmHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HrmHistoryDialog({ open, onOpenChange }: HrmHistoryDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewingSubmission, setViewingSubmission] = useState<HrmEFormSubmission | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const formsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'hrm_eforms'), orderBy('createdAt', 'desc')) : null),
    [firestore]
  );
  const { data: submissions, isLoading } = useCollection<HrmEFormSubmission>(formsQuery);

  const filtered = (submissions || []).filter((s) => {
    const matchSearch =
      !search ||
      s.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      s.formNumber?.toLowerCase().includes(search.toLowerCase()) ||
      s.position?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || s.formType === filterType;
    return matchSearch && matchType;
  });

  const handleDownloadPdf = async () => {
    if (!printRef.current || !viewingSubmission) return;
    setIsExporting(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, 297));

      const cleanName = viewingSubmission.employeeName.replace(/\s+/g, '_');
      const filename = `RCF_${viewingSubmission.formNumber}_${cleanName}.pdf`;
      pdf.save(filename);

      toast({
        title: 'ดาวน์โหลด PDF สำเร็จ',
        description: `ไฟล์ ${filename} ถูกบันทึกเรียบร้อยแล้ว`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'เกิดข้อผิดพลาดในการสร้าง PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] lg:max-w-4xl max-h-[90vh] overflow-y-auto p-4 md:p-6 bg-white">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-700" />
              ประวัติการยื่นเอกสารและคำร้อง (E-Forms Records)
            </DialogTitle>
            <DialogDescription className="text-xs">
              รวมรายการเอกสารคำร้องออนไลน์ทั้งหมดของพนักงาน สามารถดูรายละเอียดและพิมพ์เอกสารฉบับทางการได้
            </DialogDescription>
          </DialogHeader>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2 py-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="ค้นหาตามชื่อพนักงาน, เลขที่เอกสาร, ตำแหน่ง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 px-3 rounded-lg border border-input text-xs bg-background"
            >
              <option value="all">ทุกประเภทเอกสาร</option>
              <option value="leave">ใบลางาน</option>
              <option value="overtime">ใบทำงานล่วงเวลา</option>
              <option value="timesheet">ใบลงเวลาทำงาน</option>
              <option value="internal_memo">ใบติดต่องานภายใน</option>
              <option value="resignation">ใบลาออก</option>
            </select>
          </div>

          {/* List Table */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                <tr>
                  <th className="py-2.5 px-3">เลขที่เอกสาร</th>
                  <th className="py-2.5 px-3">ประเภท</th>
                  <th className="py-2.5 px-3">ชื่อพนักงาน</th>
                  <th className="py-2.5 px-3">วันที่ยื่น</th>
                  <th className="py-2.5 px-3">สถานะ</th>
                  <th className="py-2.5 px-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-slate-500" />
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      ไม่พบรายการคำร้องในระบบ
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const cfg = HRM_FORM_CONFIGS[item.formType] || HRM_FORM_CONFIGS.leave;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          {item.formNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${cfg.bgColor} ${cfg.color}`}
                          >
                            {item.formType === 'leave' && <FileText className="w-3 h-3" />}
                            {item.formType === 'overtime' && <Clock className="w-3 h-3" />}
                            {item.formType === 'timesheet' && <CalendarClock className="w-3 h-3" />}
                            {item.formType === 'internal_memo' && <FileArchive className="w-3 h-3" />}
                            {item.formType === 'resignation' && <UserMinus className="w-3 h-3" />}
                            {cfg.titleTh}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {item.employeeName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{item.date}</td>
                        <td className="py-2.5 px-3">
                          {item.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" /> อนุมัติแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                              <Clock3 className="w-3 h-3" /> รอตรวจสอบ
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewingSubmission(item)}
                            className="h-7 text-xs gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            ดูเอกสาร
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail / Official Voucher Modal */}
      {viewingSubmission && (
        <Dialog open={!!viewingSubmission} onOpenChange={() => setViewingSubmission(null)}>
          <DialogContent className="max-w-[95vw] lg:max-w-4xl max-h-[92vh] overflow-y-auto p-4 md:p-6 bg-white">
            <DialogHeader className="border-b pb-3 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {HRM_FORM_CONFIGS[viewingSubmission.formType]?.titleTh} — {viewingSubmission.formNumber}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  ผู้ขอ: {viewingSubmission.employeeName} | วันที่: {viewingSubmission.date}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  className="gap-1.5 text-xs text-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  พิมพ์
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isExporting}
                  className="gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                >
                  {isExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  ดาวน์โหลด PDF
                </Button>
              </div>
            </DialogHeader>

            <div className="overflow-x-auto bg-slate-100 p-3 rounded-lg flex justify-center my-2">
              <HrmEFormVoucher ref={printRef} submission={viewingSubmission} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
