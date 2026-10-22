'use client';

import React, { forwardRef } from 'react';
import type { HrmEFormSubmission } from '@/lib/hrm-forms-types';
import { HRM_FORM_CONFIGS } from '@/lib/hrm-forms-types';

interface HrmEFormVoucherProps {
  submission: HrmEFormSubmission;
  id?: string;
}

export const HrmEFormVoucher = forwardRef<HTMLDivElement, HrmEFormVoucherProps>(
  function HrmEFormVoucher({ submission, id }, ref) {
    const config = HRM_FORM_CONFIGS[submission.formType] || HRM_FORM_CONFIGS.leave;
    const { formData } = submission;

    return (
      <div
        ref={ref}
        id={id}
        className="w-[720px] min-h-[960px] bg-white text-slate-900 p-8 shadow-sm border border-slate-300 font-sans text-xs leading-relaxed mx-auto print:shadow-none print:border-none print:m-0 print:p-6"
        style={{ boxSizing: 'border-box' }}
      >
        {/* ================= HEADER ================= */}
        <div className="border-b-2 border-slate-800 pb-3 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 uppercase">
                บริษัท รวมโชค ฟิตเนส จำกัด / บริษัทในเครือ
              </h1>
              <p className="text-[10px] text-slate-500 font-medium">
                RUAMCHOK FITNESS CO., LTD. — ระบบบริหารงานบุคคล (RCF HRM)
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block border border-slate-800 px-2 py-0.5 font-mono font-bold text-xs bg-slate-50">
                เลขที่: {submission.formNumber}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                วันที่เขียน: {submission.date}
              </p>
            </div>
          </div>

          <div className="text-center mt-3 pt-2 border-t border-slate-200">
            <h2 className="text-lg font-black tracking-wide text-slate-900 underline underline-offset-4">
              {config.titleTh}
            </h2>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mt-0.5">
              {config.titleEn}
            </p>
          </div>
        </div>

        {/* ================= EMPLOYEE INFO BOX ================= */}
        <div className="bg-slate-50 border border-slate-300 rounded p-3 mb-4 grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
          <div>
            <span className="font-bold text-slate-700">ชื่อ - นามสกุล (ผู้ขอ): </span>
            <span className="font-semibold text-slate-900">{submission.employeeName}</span>
          </div>
          <div>
            <span className="font-bold text-slate-700">รหัสพนักงาน: </span>
            <span className="font-mono text-slate-900">{submission.employeeId || '-'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-700">ตำแหน่ง: </span>
            <span className="text-slate-900">{submission.position || 'เจ้าหน้าที่ประจำสาขา'}</span>
          </div>
          <div>
            <span className="font-bold text-slate-700">ฝ่าย / แผนก: </span>
            <span className="text-slate-900">{submission.department || 'รวมโชค ฟิตเนส'}</span>
          </div>
        </div>

        {/* ================= FORM DETAILS BY TYPE ================= */}
        <div className="mb-6 space-y-4">
          {/* 1. LEAVE FORM */}
          {submission.formType === 'leave' && (
            <div className="border border-slate-300 rounded p-4 space-y-3">
              <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                <span>รายละเอียดการขอลาหยุดงาน</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                  ประเภท: {formData.leaveType || '-'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-700">ตั้งแต่วันที่: </span>
                  <span>{formData.startDate || '-'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">ถึงวันที่: </span>
                  <span>{formData.endDate || formData.startDate || '-'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">จำนวนวันที่ลา: </span>
                  <span className="font-bold text-blue-700">{formData.days || 1} วัน</span>
                </div>
                {formData.swapWith && (
                  <div>
                    <span className="font-bold text-slate-700">สลับวันหยุดกับ: </span>
                    <span>{formData.swapWith}</span>
                  </div>
                )}
                {formData.hospitalNote && (
                  <div>
                    <span className="font-bold text-slate-700">ใบเสร็จ/รพ.: </span>
                    <span>{formData.hospitalNote}</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">เหตุผลความจำเป็นในการลา:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-800 min-h-[50px] whitespace-pre-line">
                  {formData.reason || 'ไม่ได้ระบุเหตุผล'}
                </div>
              </div>
            </div>
          )}

          {/* 2. OVERTIME FORM */}
          {submission.formType === 'overtime' && (
            <div className="border border-slate-300 rounded p-4 space-y-3">
              <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                <span>รายละเอียดการขออนุมัติทำงานล่วงเวลา (O.T.)</span>
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-semibold">
                  {formData.otType === 'holiday' ? 'ทำงานในวันหยุด' : 'ทำงานล่วงเวลา (OT)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-700">วันที่ปฏิบัติงาน: </span>
                  <span>{formData.date || submission.date}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">ช่วงเวลาปฏิบัติงาน: </span>
                  <span>{formData.startTime || '00:00'} น. ถึง {formData.endTime || '00:00'} น.</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">รวมจำนวนชั่วโมง: </span>
                  <span className="font-bold text-orange-700">{formData.hours || '-'} ชั่วโมง</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">เหตุผลความจำเป็นและงานที่ต้องปฏิบัติ:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-800 min-h-[60px] whitespace-pre-line">
                  {formData.reason || 'ไม่ได้ระบุเหตุผล'}
                </div>
              </div>
            </div>
          )}

          {/* 3. TIMESHEET FORM */}
          {submission.formType === 'timesheet' && (
            <div className="border border-slate-300 rounded p-4 space-y-3">
              <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                <span>รายละเอียดการบันทึก / แก้ไขเวลาทำงาน</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                  ประเภท: {formData.timeType || 'ลืมบันทึกเวลา'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-700">วันที่ที่ต้องการบันทึก: </span>
                  <span>{formData.date || submission.date}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">เวลาจริงที่เข้า/ออกงาน: </span>
                  <span className="font-bold text-emerald-700">{formData.actualTime || '-'} น.</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">รายละเอียดและสาเหตุความจำเป็น:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-800 min-h-[60px] whitespace-pre-line">
                  {formData.reason || 'ไม่ได้ระบุรายละเอียด'}
                </div>
              </div>
            </div>
          )}

          {/* 4. INTERNAL MEMO FORM */}
          {submission.formType === 'internal_memo' && (
            <div className="border border-slate-300 rounded p-4 space-y-3">
              <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                <span>ข้อความติดต่อประสานงานภายใน / ขอเอกสาร</span>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold">
                  ความเร่งด่วน: {formData.urgency === 'urgent' ? 'ด่วน' : 'ปกติ'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="font-bold text-slate-700">เรื่อง: </span>
                  <span className="font-bold text-slate-900">{formData.topic || '-'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">เรียน: </span>
                  <span>{formData.to || 'ผู้จัดการ / ฝ่ายที่เกี่ยวข้อง'}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">รายละเอียดข้อความ / สิ่งที่ต้องการติดต่อ:</span>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-800 min-h-[90px] whitespace-pre-line leading-relaxed">
                  {formData.details || 'ไม่มีรายละเอียด'}
                </div>
              </div>
            </div>
          )}

          {/* 5. RESIGNATION FORM */}
          {submission.formType === 'resignation' && (
            <div className="border border-slate-300 rounded p-4 space-y-3">
              <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between items-center">
                <span>รายละเอียดการขอลาออกจากการเป็นพนักงาน</span>
                <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-semibold">
                  แจ้งล่วงหน้าตามระเบียบบริษัท
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-700">วันที่เริ่มงาน: </span>
                  <span>{formData.startDate || '-'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700">วันทำงานวันสุดท้าย (มีผล): </span>
                  <span className="font-bold text-rose-700">{formData.lastWorkingDate || '-'}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700 block mb-1">เหตุผลความจำเป็นในการลาออก:</span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-800 min-h-[60px] whitespace-pre-line">
                  {formData.reason || 'ไม่ได้ระบุเหตุผล'}
                </div>
              </div>
              {formData.feedback && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1">ข้อคิดเห็นและข้อเสนอแนะต่อบริษัท:</span>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-slate-700 whitespace-pre-line">
                    {formData.feedback}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= SIGNATURE & APPROVAL GRID ================= */}
        <div className="mt-6 border-t-2 border-slate-800 pt-4">
          <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
            {/* Box 1: Employee Signature */}
            <div className="border border-slate-300 rounded p-2.5 flex flex-col justify-between min-h-[140px] bg-slate-50/50">
              <span className="font-bold text-slate-700">ลงชื่อผู้ยื่นคำขอ</span>
              <div className="h-16 flex items-center justify-center my-1">
                {submission.signature ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={submission.signature}
                    alt="Employee Signature"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-slate-300 italic text-[10px]">ลายเซ็นดิจิทัล</span>
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-800">({submission.employeeName})</p>
                <p className="text-[10px] text-slate-500">วันที่: {submission.date}</p>
              </div>
            </div>

            {/* Box 2: Supervisor / Manager */}
            <div className="border border-slate-300 rounded p-2.5 flex flex-col justify-between min-h-[140px]">
              <span className="font-bold text-slate-700">หัวหน้างาน / ผู้จัดการสาขา</span>
              <div className="h-16 flex items-center justify-center my-1 text-slate-300 italic text-[10px]">
                {submission.status === 'approved' ? (
                  <span className="text-emerald-600 font-bold text-xs">✓ อนุมัติแล้ว</span>
                ) : (
                  <span>[ ........................................ ]</span>
                )}
              </div>
              <div>
                <p className="text-slate-600">(...................................................)</p>
                <p className="text-[10px] text-slate-400">วันที่: ..... / ..... / .........</p>
              </div>
            </div>

            {/* Box 3: HR / Administration */}
            <div className="border border-slate-300 rounded p-2.5 flex flex-col justify-between min-h-[140px]">
              <span className="font-bold text-slate-700">ฝ่ายบุคคล (HR) / ผู้อนุมัติ</span>
              <div className="h-16 flex items-center justify-center my-1 text-slate-300 italic text-[10px]">
                <span>[ ........................................ ]</span>
              </div>
              <div>
                <p className="text-slate-600">(...................................................)</p>
                <p className="text-[10px] text-slate-400">วันที่: ..... / ..... / .........</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-400">
            เอกสารอิเล็กทรอนิกส์สร้างโดยระบบบริหารงานบุคคล รวมโชค ฟิตเนส (RCF HRM System) — สามารถใช้เป็นหลักฐานทางการได้
          </div>
        </div>
      </div>
    );
  }
);
