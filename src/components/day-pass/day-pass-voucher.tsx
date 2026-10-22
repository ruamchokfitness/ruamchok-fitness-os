'use client';

import React from 'react';
import type { DayPassTicket, DayPassPackageType, DayPassPaymentMethod } from '@/lib/types';
import { RCF_DAY_PASS_LOGO } from '@/lib/day-pass-logo';

interface DayPassVoucherProps {
  ticket: Partial<DayPassTicket> & {
    ticket_no: string;
    client_name: string;
    phone: string;
    package_type: DayPassPackageType;
    price: number;
    payment_method: DayPassPaymentMethod;
    date: string;
  };
  className?: string;
  id?: string;
}

const PAYMENT_METHOD_LABELS: Record<DayPassPaymentMethod, string> = {
  cash: 'Cash (เงินสด)',
  transfer: 'Transfer / QR Code Scan (โอนเงิน / สแกน QR)',
  credit_card: 'Credit Card (บัตรเครดิต)',
};

export const DayPassVoucher = React.forwardRef<HTMLDivElement, DayPassVoucherProps>(
  ({ ticket, className = '', id }, ref) => {
    return (
      <div
        ref={ref}
        id={id}
        className={`bg-white text-slate-900 font-sans p-6 sm:p-7 border border-slate-300 rounded-xl shadow-sm print:shadow-none print:border-none print:p-0 mx-auto text-xs ${className}`}
        style={{ width: '750px', maxWidth: '100%', boxSizing: 'border-box' }}
      >
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between pb-3.5 border-b-2 border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <img
              src={RCF_DAY_PASS_LOGO}
              alt="Ruamchok Fitness Logo"
              className="h-11 object-contain"
            />
            <div>
              <h2 className="font-black text-base text-slate-900 tracking-wider uppercase">
                RUAMCHOK FITNESS
              </h2>
              <span className="inline-block bg-slate-900 text-white font-bold text-[10px] px-2.5 py-0.5 rounded tracking-widest uppercase">
                ONE DAY PASS
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              COUPON NO.
            </span>
            <span className="font-mono font-black text-red-600 text-xl tracking-wider block">
              {ticket.ticket_no || 'DP09770'}
            </span>
            <span className="text-xs text-slate-600 font-medium">
              วันที่ / Date: <strong className="text-slate-800">{ticket.date}</strong>
            </span>
          </div>
        </div>

        {/* ================= DETAILS SECTION ================= */}
        <div className="grid grid-cols-2 gap-4 my-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
          {/* Customer Details */}
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="font-semibold text-slate-600">Full Name / ชื่อ-สกุล:</span>
              <span className="font-bold text-slate-900 text-right">{ticket.client_name || '-'}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="font-semibold text-slate-600">Phone / เบอร์โทรศัพท์:</span>
              <span className="font-mono font-medium text-slate-800 text-right">{ticket.phone || '-'}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="font-semibold text-slate-600">Locker No. / ล็อกเกอร์:</span>
              <span className="font-bold text-slate-900 text-right">{ticket.locker_no || '-'}</span>
            </div>
          </div>

          {/* Package & Payment Details */}
          <div className="space-y-2 pl-3 border-l border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="font-semibold text-slate-600">Package / แพ็กเกจ:</span>
              <span className="font-bold text-slate-900 text-right">{ticket.package_type || '-'}</span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="font-semibold text-slate-600">Fee / ค่าบริการ:</span>
              <span className="font-black text-slate-900 text-right">
                ฿{(ticket.price || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-slate-200 pb-1">
              <span className="font-semibold text-slate-600">Payment / การชำระเงิน:</span>
              <span className="font-medium text-slate-800 text-right">
                {PAYMENT_METHOD_LABELS[ticket.payment_method] || ticket.payment_method || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* ================= POLICY SECTION (4 BILINGUAL CLAUSES) ================= */}
        <div className="my-3.5 p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg text-[10px] space-y-2 leading-relaxed text-slate-700">
          <div className="font-bold text-slate-900 text-[11px] border-b border-slate-200 pb-1">
            ข้อกำหนดการใช้บริการ / Ruamchok Fitness Policy
          </div>

          <div className="space-y-0.5">
            <p className="font-medium text-slate-800">
              1. รวมโชค ฟิตเนสขอสงวนสิทธิ์ไม่รับผิดชอบต่อทรัพย์สินที่สูญหายหรือถูกโจรกรรม
            </p>
            <p className="text-slate-600 italic pl-3">
              Ruamchok Fitness is not responsible for lost or stolen items.
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="font-medium text-slate-800">
              2. รวมโชค ฟิตเนสไม่รับผิดชอบต่อการบาดเจ็บหรือความเสียหายใด ๆ ที่อาจเกิดขึ้นระหว่างการใช้บริการ กรุณาปรึกษาแพทย์ก่อนใช้บริการหากมีปัญหาสุขภาพ
            </p>
            <p className="text-slate-600 italic pl-3">
              Ruamchok Fitness is not liable for any injury or damage that may occur during your visit. Please consult your doctor if you have any health concerns.
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="font-medium text-slate-800">
              3. สมาชิกและผู้ใช้บริการต้องปฏิบัติตามกฎระเบียบของฟิตเนส สวมใส่ชุดและรองเท้ากีฬาที่เหมาะสมขณะออกกำลังกาย
            </p>
            <p className="text-slate-600 italic pl-3">
              Guests must comply with fitness rules and wear appropriate athletic attire and footwear at all times.
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="font-medium text-slate-800">
              4. คูปองนี้ใช้ได้เฉพาะบุคคลและมีอายุการใช้งานภายในวันที่ระบุเท่านั้น ไม่สามารถโอนสิทธิ์หรือขอคืนเงินได้
            </p>
            <p className="text-slate-600 italic pl-3">
              This day pass is non-refundable, non-transferable, and valid only on the date of issuance.
            </p>
          </div>
        </div>

        {/* ================= SIGNATURES ROW (3 COLUMNS) ================= */}
        <div className="mt-4 pt-3 border-t border-slate-300 grid grid-cols-3 gap-3 text-center text-[10px]">
          {/* Member's Signature */}
          <div>
            <div className="h-16 border-b border-slate-400 flex items-center justify-center bg-slate-50/50 rounded mb-1 p-1">
              {ticket.client_signature ? (
                <img
                  src={ticket.client_signature}
                  alt="Member Signature"
                  className="max-h-14 max-w-full object-contain"
                />
              ) : (
                <span className="text-slate-300 italic text-[10px]">ลายเซ็นสมาชิก</span>
              )}
            </div>
            <span className="text-slate-700 font-semibold block">
              ลายเซ็นสมาชิก / Member's Signature
            </span>
          </div>

          {/* Staff Signature */}
          <div>
            <div className="h-16 border-b border-slate-400 flex items-center justify-center bg-slate-50/50 rounded mb-1 p-1">
              {ticket.staff_signature ? (
                <img
                  src={ticket.staff_signature}
                  alt="Staff Signature"
                  className="max-h-14 max-w-full object-contain"
                />
              ) : ticket.staff_name ? (
                <span className="text-slate-800 font-semibold text-xs">{ticket.staff_name}</span>
              ) : (
                <span className="text-slate-300 italic text-[10px]">ลายเซ็นพนักงาน</span>
              )}
            </div>
            <span className="text-slate-700 font-semibold block">
              ลายเซ็นพนักงานขาย / Staff Signature
            </span>
          </div>

          {/* Date */}
          <div>
            <div className="h-16 border-b border-slate-400 flex items-center justify-center bg-slate-50/50 rounded mb-1 font-bold text-slate-800 text-xs">
              {ticket.date}
            </div>
            <span className="text-slate-700 font-semibold block">
              วันที่ / Date
            </span>
          </div>
        </div>
      </div>
    );
  }
);

DayPassVoucher.displayName = 'DayPassVoucher';
