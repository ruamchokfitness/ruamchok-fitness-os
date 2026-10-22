'use client';

import React, { useState, useRef, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/signature-pad';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import type { HrmFormType, HrmEFormSubmission } from '@/lib/hrm-forms-types';
import { HRM_FORM_CONFIGS } from '@/lib/hrm-forms-types';
import { HrmEFormVoucher } from './hrm-eform-voucher';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Loader2,
  Send,
  Download,
  Printer,
  CheckCircle2,
  FileText,
  Clock,
  CalendarClock,
  FileArchive,
  UserMinus,
  RotateCcw,
} from 'lucide-react';

interface HrmEFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formType: HrmFormType;
  onFormTypeChange?: (type: HrmFormType) => void;
  employees: Employee[];
}

export function HrmEFormDialog({
  open,
  onOpenChange,
  formType,
  onFormTypeChange,
  employees,
}: HrmEFormDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Common Fields
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [position, setPosition] = useState('เจ้าหน้าที่ประจำสาขา');
  const [department, setDepartment] = useState('รวมโชค ฟิตเนส');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [signature, setSignature] = useState('');

  // 1. Leave fields
  const [leaveType, setLeaveType] = useState('ลาพักร้อน');
  const [leaveStartDate, setLeaveStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSwapWith, setLeaveSwapWith] = useState('');
  const [leaveHospitalNote, setLeaveHospitalNote] = useState('');

  // 2. Overtime fields
  const [otType, setOtType] = useState<'overtime' | 'holiday'>('overtime');
  const [otDate, setOtDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [otStartTime, setOtStartTime] = useState('17:00');
  const [otEndTime, setOtEndTime] = useState('21:00');
  const [otHours, setOtHours] = useState('4');
  const [otReason, setOtReason] = useState('');

  // 3. Timesheet fields
  const [tsDate, setTsDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tsTimeType, setTsTimeType] = useState('ลืมบันทึกเวลา');
  const [tsActualTime, setTsActualTime] = useState('08:00');
  const [tsReason, setTsReason] = useState('');

  // 4. Internal Memo fields
  const [memoTopic, setMemoTopic] = useState('');
  const [memoTo, setMemoTo] = useState('ผู้จัดการสาขา / ฝ่ายบุคคล');
  const [memoDetails, setMemoDetails] = useState('');
  const [memoUrgency, setMemoUrgency] = useState<'normal' | 'urgent'>('normal');

  // 5. Resignation fields
  const [resStartDate, setResStartDate] = useState('');
  const [resLastWorkingDate, setResLastWorkingDate] = useState('');
  const [resReason, setResReason] = useState('');
  const [resFeedback, setResFeedback] = useState('');

  // Result state after submission
  const [submittedData, setSubmittedData] = useState<HrmEFormSubmission | null>(null);
  const printVoucherRef = useRef<HTMLDivElement>(null);

  // Handle Employee Selection
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setEmployeeName(emp.name);
    }
  };

  // Reset form
  const handleResetForm = () => {
    setSelectedEmployeeId('');
    setEmployeeName('');
    setSignature('');
    setLeaveReason('');
    setOtReason('');
    setTsReason('');
    setMemoTopic('');
    setMemoDetails('');
    setResReason('');
    setResFeedback('');
    setSubmittedData(null);
  };

  const handleClose = () => {
    handleResetForm();
    onOpenChange(false);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = employeeName.trim();
    if (!finalName) {
      toast({
        title: 'กรุณาระบุชื่อพนักงาน',
        description: 'กรุณาเลือกพนักงานหรือพิมพ์ชื่อผู้ขอ',
        variant: 'destructive',
      });
      return;
    }

    if (!signature) {
      toast({
        title: 'กรุณาเซ็นชื่อ',
        description: 'กรุณาวาดลายเซ็นดิจิทัลในช่องลายเซ็นก่อนส่งคำร้อง',
        variant: 'destructive',
      });
      return;
    }

    if (!firestore) return;
    setIsSubmitting(true);

    try {
      const config = HRM_FORM_CONFIGS[formType];
      const timestampStr = new Date()
        .toISOString()
        .replace(/[-:T.]/g, '')
        .substring(0, 14);
      const formNumber = `${config.prefix}-${timestampStr.substring(2, 8)}-${Math.floor(100 + Math.random() * 900)}`;

      let specificFormData: Record<string, any> = {};

      if (formType === 'leave') {
        specificFormData = {
          leaveType,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          days: parseFloat(leaveDays) || 1,
          reason: leaveReason.trim(),
          swapWith: leaveSwapWith.trim(),
          hospitalNote: leaveHospitalNote.trim(),
        };
      } else if (formType === 'overtime') {
        specificFormData = {
          otType,
          date: otDate,
          startTime: otStartTime,
          endTime: otEndTime,
          hours: parseFloat(otHours) || 0,
          reason: otReason.trim(),
        };
      } else if (formType === 'timesheet') {
        specificFormData = {
          date: tsDate,
          timeType: tsTimeType,
          actualTime: tsActualTime,
          reason: tsReason.trim(),
        };
      } else if (formType === 'internal_memo') {
        specificFormData = {
          topic: memoTopic.trim(),
          to: memoTo.trim(),
          details: memoDetails.trim(),
          urgency: memoUrgency,
        };
      } else if (formType === 'resignation') {
        specificFormData = {
          startDate: resStartDate,
          lastWorkingDate: resLastWorkingDate,
          reason: resReason.trim(),
          feedback: resFeedback.trim(),
        };
      }

      const docId = `form_${Date.now()}`;
      const submission: HrmEFormSubmission = {
        id: docId,
        formType,
        formNumber,
        employeeId: selectedEmployeeId || 'general',
        employeeName: finalName,
        position: position.trim() || 'เจ้าหน้าที่ประจำสาขา',
        department: department.trim() || 'รวมโชค ฟิตเนส',
        date: formDate,
        signature,
        status: 'pending',
        formData: specificFormData,
        createdAt: serverTimestamp(),
      };

      // 1. Save to hrm_eforms collection
      await setDoc(doc(firestore, 'hrm_eforms', docId), submission);

      // 2. If leave form, link to leaves collection for calendar/quota
      if (formType === 'leave' && selectedEmployeeId) {
        try {
          const leaveId = `leave_${Date.now()}`;
          await setDoc(doc(firestore, 'leaves', leaveId), {
            id: leaveId,
            employeeId: selectedEmployeeId,
            date: leaveStartDate,
            type: leaveType,
            days: parseFloat(leaveDays) || 1,
          });
        } catch (leaveErr) {
          console.error('Error auto-syncing leave to calendar:', leaveErr);
        }
      }

      setSubmittedData(submission);

      toast({
        title: `ยื่น${config.titleTh}สำเร็จ! 🎉`,
        description: `เลขที่เอกสาร: ${formNumber} บันทึกเข้าระบบเรียบร้อยแล้ว`,
      });
    } catch (error: any) {
      console.error('Submit eform error:', error);
      toast({
        title: 'เกิดข้อผิดพลาดในการส่งคำร้อง',
        description: error?.message || 'Network error',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export PDF Handler
  const handleDownloadPdf = async () => {
    if (!printVoucherRef.current || !submittedData) return;
    setIsExportingPdf(true);
    try {
      const element = printVoucherRef.current;
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

      const cleanName = submittedData.employeeName.replace(/\s+/g, '_');
      const filename = `RCF_${submittedData.formNumber}_${cleanName}.pdf`;
      pdf.save(filename);

      toast({
        title: 'ดาวน์โหลด PDF สำเร็จ',
        description: `บันทึกไฟล์ ${filename} เรียบร้อยแล้ว`,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast({
        title: 'ไม่สามารถสร้าง PDF ได้',
        variant: 'destructive',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const currentConfig = HRM_FORM_CONFIGS[formType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-3xl max-h-[92vh] overflow-y-auto p-4 md:p-6 bg-white">
        {/* ================= SUCCESS VIEW WITH OFFICIAL VOUCHER ================= */}
        {submittedData ? (
          <div className="space-y-4">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900">
                      ยื่น{currentConfig.titleTh}สำเร็จเรียบร้อย!
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      เลขที่เอกสาร: <strong className="font-mono">{submittedData.formNumber}</strong> | ผู้ยื่น: {submittedData.employeeName}
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="gap-1.5 text-xs text-slate-700"
                  >
                    <Printer className="w-4 h-4" />
                    พิมพ์
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownloadPdf}
                    disabled={isExportingPdf}
                    className="gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                  >
                    {isExportingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    ดาวน์โหลด PDF
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {/* Official Voucher Preview */}
            <div className="overflow-x-auto bg-slate-100 p-3 rounded-lg flex justify-center">
              <HrmEFormVoucher ref={printVoucherRef} submission={submittedData} />
            </div>

            <DialogFooter className="pt-2 border-t flex sm:justify-between items-center">
              <span className="text-xs text-slate-500">
                💡 ข้อมูลถูกบันทึกเข้าระบบ RCF HRM เรียบร้อยแล้ว
              </span>
              <Button variant="secondary" onClick={handleClose}>
                ปิดหน้าต่าง
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ================= INPUT FORM VIEW ================= */
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader className="border-b pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${currentConfig.bgColor}`}>
                    {formType === 'leave' && <FileText className="w-5 h-5 text-blue-600" />}
                    {formType === 'overtime' && <Clock className="w-5 h-5 text-orange-600" />}
                    {formType === 'timesheet' && <CalendarClock className="w-5 h-5 text-emerald-600" />}
                    {formType === 'internal_memo' && <FileArchive className="w-5 h-5 text-purple-600" />}
                    {formType === 'resignation' && <UserMinus className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900">
                      แบบฟอร์ม{currentConfig.titleTh} ({currentConfig.titleEn})
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      กรอกข้อมูลง่ายๆ สำหรับพนักงาน ระบบจะนำไปประกอบลงในแบบฟอร์มทางการให้อัตโนมัติ
                    </DialogDescription>
                  </div>
                </div>

                {/* Form Type Selector Pills */}
                {onFormTypeChange && (
                  <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                    {(Object.keys(HRM_FORM_CONFIGS) as HrmFormType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onFormTypeChange(t)}
                        className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                          formType === t
                            ? 'bg-white text-slate-900 shadow-sm font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {HRM_FORM_CONFIGS[t].titleTh}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* ================= STEP 1: EMPLOYEE INFO ================= */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                1. ข้อมูลผู้ยื่นคำขอ (Employee Information)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="empSelect" className="text-xs font-semibold text-slate-700">
                    เลือกพนักงาน:
                  </Label>
                  <Select value={selectedEmployeeId} onValueChange={handleSelectEmployee}>
                    <SelectTrigger id="empSelect" className="bg-white rounded-lg h-9 text-xs">
                      <SelectValue placeholder="เลือกรายชื่อพนักงาน..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs">
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="empName" className="text-xs font-semibold text-slate-700">
                    ชื่อ-นามสกุลผู้ยื่น:
                  </Label>
                  <Input
                    id="empName"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="พิมพ์ชื่อ-นามสกุล..."
                    className="bg-white rounded-lg h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="formDate" className="text-xs font-semibold text-slate-700">
                    วันที่เขียนคำขอ:
                  </Label>
                  <Input
                    id="formDate"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="bg-white rounded-lg h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="pos" className="text-xs font-semibold text-slate-700">
                    ตำแหน่ง:
                  </Label>
                  <Input
                    id="pos"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="เช่น เทรนเนอร์, พนักงานต้อนรับ..."
                    className="bg-white rounded-lg h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dept" className="text-xs font-semibold text-slate-700">
                    ฝ่าย / แผนก:
                  </Label>
                  <Input
                    id="dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="เช่น ฟิตเนส, บริหารทั่วไป..."
                    className="bg-white rounded-lg h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* ================= STEP 2: FORM SPECIFIC FIELDS ================= */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                2. รายละเอียดคำร้อง (Form Details)
              </span>

              {/* A. LEAVE FORM */}
              {formType === 'leave' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ประเภทการลา:
                      </Label>
                      <Select value={leaveType} onValueChange={setLeaveType}>
                        <SelectTrigger className="bg-white rounded-lg h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ลาพักร้อน">ลาพักร้อน (Annual Leave)</SelectItem>
                          <SelectItem value="ลาป่วย">ลาป่วย (Sick Leave)</SelectItem>
                          <SelectItem value="ลากิจ (มาทำงานชดเชย)">ลากิจ - มาทำงานชดเชย</SelectItem>
                          <SelectItem value="ลากิจ (ไม่ได้รับค่าจ้าง)">ลากิจ - ไม่ได้รับค่าจ้าง</SelectItem>
                          <SelectItem value="เปลี่ยนวันหยุด">เปลี่ยนวันหยุด (Shift Swap)</SelectItem>
                          <SelectItem value="ใช้สิทธิ์นักขัตฤกษ์">ใช้สิทธิ์นักขัตฤกษ์ (Holiday)</SelectItem>
                          <SelectItem value="วันเกิด">วันเกิด (Birthday Leave)</SelectItem>
                          <SelectItem value="ลาอื่นๆ">ลาอื่นๆ (Other)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        จำนวนวันที่ลา:
                      </Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={leaveDays}
                        onChange={(e) => setLeaveDays(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ตั้งแต่วันที่:
                      </Label>
                      <Input
                        type="date"
                        value={leaveStartDate}
                        onChange={(e) => {
                          setLeaveStartDate(e.target.value);
                          if (!leaveEndDate || leaveEndDate < e.target.value) {
                            setLeaveEndDate(e.target.value);
                          }
                        }}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ถึงวันที่:
                      </Label>
                      <Input
                        type="date"
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  {leaveType === 'เปลี่ยนวันหยุด' && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-blue-700">
                        ระบุชื่อพนักงานที่สลับกะด้วย:
                      </Label>
                      <Input
                        value={leaveSwapWith}
                        onChange={(e) => setLeaveSwapWith(e.target.value)}
                        placeholder="ชื่อพนักงานที่ตกลงสลับวันหยุดด้วย..."
                        className="bg-blue-50/50 rounded-lg h-9 text-xs border-blue-200"
                      />
                    </div>
                  )}

                  {leaveType === 'ลาป่วย' && (
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ใบเสร็จ / ใบรับรองแพทย์จาก รพ. (ถ้ามี):
                      </Label>
                      <Input
                        value={leaveHospitalNote}
                        onChange={(e) => setLeaveHospitalNote(e.target.value)}
                        placeholder="เช่น รพ.กรุงเทพเชียงใหม่, คลินิก..."
                        className="bg-white rounded-lg h-9 text-xs"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      เหตุผลความจำเป็นในการลา:
                    </Label>
                    <Textarea
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="ระบุเหตุผลในการขอลา..."
                      className="rounded-lg text-xs h-20"
                      required
                    />
                  </div>
                </div>
              )}

              {/* B. OVERTIME FORM */}
              {formType === 'overtime' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ประเภทการขอ:
                      </Label>
                      <Select
                        value={otType}
                        onValueChange={(v) => setOtType(v as 'overtime' | 'holiday')}
                      >
                        <SelectTrigger className="bg-white rounded-lg h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overtime">ทำงานล่วงเวลา (OT วันปกติ)</SelectItem>
                          <SelectItem value="holiday">ทำงานในวันหยุด (Holiday Work)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        วันที่ปฏิบัติงาน:
                      </Label>
                      <Input
                        type="date"
                        value={otDate}
                        onChange={(e) => setOtDate(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ตั้งแต่เวลา:
                      </Label>
                      <Input
                        type="time"
                        value={otStartTime}
                        onChange={(e) => setOtStartTime(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ถึงเวลา:
                      </Label>
                      <Input
                        type="time"
                        value={otEndTime}
                        onChange={(e) => setOtEndTime(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        รวมชั่วโมง:
                      </Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={otHours}
                        onChange={(e) => setOtHours(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs font-bold text-orange-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      เหตุผลความจำเป็นและงานที่ต้องปฏิบัติ:
                    </Label>
                    <Textarea
                      value={otReason}
                      onChange={(e) => setOtReason(e.target.value)}
                      placeholder="ระบุภารกิจหรืองานที่ต้องทำล่วงเวลา..."
                      className="rounded-lg text-xs h-20"
                      required
                    />
                  </div>
                </div>
              )}

              {/* C. TIMESHEET FORM */}
              {formType === 'timesheet' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        วันที่เกิดรายการ:
                      </Label>
                      <Input
                        type="date"
                        value={tsDate}
                        onChange={(e) => setTsDate(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        ประเภทรายการ:
                      </Label>
                      <Select value={tsTimeType} onValueChange={setTsTimeType}>
                        <SelectTrigger className="bg-white rounded-lg h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ลืมบันทึกเวลา">ลืมบันทึกเวลา (Missed Punch)</SelectItem>
                          <SelectItem value="เข้างาน">เข้างาน (Check-In)</SelectItem>
                          <SelectItem value="ออกงาน">ออกงาน (Check-Out)</SelectItem>
                          <SelectItem value="เข้าเบรก">เข้าเบรก (Break In)</SelectItem>
                          <SelectItem value="ออกเบรก">ออกเบรก (Break Out)</SelectItem>
                          <SelectItem value="ระบบขัดข้อง">ระบบสแกนนิ้วขัดข้อง</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        เวลาจริงที่เข้า/ออก:
                      </Label>
                      <Input
                        type="time"
                        value={tsActualTime}
                        onChange={(e) => setTsActualTime(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      รายละเอียดและสาเหตุความจำเป็น:
                    </Label>
                    <Textarea
                      value={tsReason}
                      onChange={(e) => setTsReason(e.target.value)}
                      placeholder="ระบุสาเหตุ เช่น ปฏิบัติงานนอกสถานที่, ลืมสแกนนิ้ว..."
                      className="rounded-lg text-xs h-20"
                      required
                    />
                  </div>
                </div>
              )}

              {/* D. INTERNAL MEMO FORM */}
              {formType === 'internal_memo' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        เรื่อง (Topic):
                      </Label>
                      <Input
                        value={memoTopic}
                        onChange={(e) => setMemoTopic(e.target.value)}
                        placeholder="เช่น ขอเบิกอุปกรณ์, ขอเอกสารรับรองงาน..."
                        className="bg-white rounded-lg h-9 text-xs font-semibold"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        เรียน (To):
                      </Label>
                      <Input
                        value={memoTo}
                        onChange={(e) => setMemoTo(e.target.value)}
                        placeholder="เช่น ผู้จัดการสาขา, ฝ่ายบุคคล..."
                        className="bg-white rounded-lg h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      รายละเอียดข้อความ / สิ่งที่ต้องการติดต่อ:
                    </Label>
                    <Textarea
                      value={memoDetails}
                      onChange={(e) => setMemoDetails(e.target.value)}
                      placeholder="พิมพ์รายละเอียดเนื้อหาของเอกสาร..."
                      className="rounded-lg text-xs h-28"
                      required
                    />
                  </div>
                </div>
              )}

              {/* E. RESIGNATION FORM */}
              {formType === 'resignation' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-700">
                        วันที่เริ่มงาน (ถ้าจำได้):
                      </Label>
                      <Input
                        type="date"
                        value={resStartDate}
                        onChange={(e) => setResStartDate(e.target.value)}
                        className="bg-white rounded-lg h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-rose-700">
                        วันทำงานวันสุดท้าย (มีผลบังคับใช้):
                      </Label>
                      <Input
                        type="date"
                        value={resLastWorkingDate}
                        onChange={(e) => setResLastWorkingDate(e.target.value)}
                        className="bg-rose-50/50 rounded-lg h-9 text-xs border-rose-200 font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      เหตุผลความจำเป็นในการลาออก:
                    </Label>
                    <Textarea
                      value={resReason}
                      onChange={(e) => setResReason(e.target.value)}
                      placeholder="ระบุเหตุผล เช่น ศึกษาต่อ, ประกอบธุรกิจส่วนตัว, ย้ายภูมิลำเนา..."
                      className="rounded-lg text-xs h-20"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">
                      ข้อคิดเห็น / ข้อเสนอแนะต่อบริษัท (ถ้ามี):
                    </Label>
                    <Textarea
                      value={resFeedback}
                      onChange={(e) => setResFeedback(e.target.value)}
                      placeholder="ข้อคิดเห็นเพื่อการพัฒนาปรับปรุงบริษัท..."
                      className="rounded-lg text-xs h-16"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ================= STEP 3: DIGITAL SIGNATURE ================= */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  3. ลายเซ็นดิจิทัลผู้ยื่นคำขอ (Digital Signature)
                </span>
                <span className="text-[11px] text-slate-500">
                  * ใช้มือหรือเมาส์เซ็นชื่อในกรอบด้านล่าง
                </span>
              </div>
              <SignaturePad
                label=""
                onSignatureChange={setSignature}
                className="w-full"
              />
            </div>

            {/* ================= FOOTER BUTTONS ================= */}
            <DialogFooter className="pt-2 border-t flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResetForm}
                className="gap-1.5 text-xs text-slate-600"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ล้างข้อมูล
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 py-5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                บันทึกและยื่นคำขอ ({currentConfig.titleTh})
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
