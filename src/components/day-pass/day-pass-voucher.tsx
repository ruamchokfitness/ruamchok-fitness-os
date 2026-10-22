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
        className={`bg-white text-slate-900 font-sans p-7 border border-slate-300 rounded-xl shadow-sm print:shadow-none print:border-none print:p-2 w-full max-w-[860px] mx-auto text-xs ${className}`}
      >
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <img
              src={RCF_DAY_PASS_LOGO}
              alt="Ruamchok Fitness Logo"
              className="h-12 object-contain"
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
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          {/* Customer Details */}
          <div className="space-y-2">
            <div className="flex items-baseline">
              <span className="font-semibold text-slate-600 w-36 shrink-0">
                Full Name / ชื่อ-สกุล:
              </span>
              <span className="font-bold text-slate-900 text-sm border-b border-dotted border-slate-400 flex-1 pl-1">
                {ticket.client_name || '-'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-semibold text-slate-600 w-36 shrink-0">
                Phone / เบอร์โทรศัพท์:
              </span>
              <span className="font-mono font-medium text-slate-800 border-b border-dotted border-slate-400 flex-1 pl-1">
                {ticket.phone || '-'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-semibold text-slate-600 w-36 shrink-0">
                Locker No. / ล็อกเกอร์:
              </span>
              <span className="font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 pl-1">
                {ticket.locker_no || '-'}
              </span>
            </div>
          </div>

          {/* Package & Payment Details */}
          <div className="space-y-2 md:pl-3 md:border-l border-slate-200">
            <div className="flex items-baseline">
              <span className="font-semibold text-slate-600 w-36 shrink-0">
                Package / แพ็กเกจ:
              </span>
              <span className="font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 pl-1">
                {ticket.package_type || '-'}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-semibold text-slate-600 w-36 shrink-0">
                Fee / ค่าบริการ:
              </span>
              <span className="font-black text-slate-900 text-sm border-b border-dotted border-slate-400 flex-1 pl-1">
                ฿{(ticket.price || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="font-semibold text-slate-600 w-36 shrink-0">
                Payment / การชำระเงิน:
              </span>
              <span className="font-medium text-slate-800 border-b border-dotted border-slate-400 flex-1 pl-1">
                {PAYMENT_METHOD_LABELS[ticket.payment_method] || ticket.payment_method || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* ================= POLICY SECTION (4 BILINGUAL CLAUSES) ================= */}
        <div className="my-4 p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg text-[10.5px] space-y-2 leading-relaxed text-slate-700">
          <div className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
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
        <div className="mt-5 pt-3 border-t border-slate-300 grid grid-cols-3 gap-4 text-center text-[10.5px]">
          {/* Member's Signature */}
          <div>
            <div className="h-16 border-b border-slate-400 flex items-center justify-center bg-slate-50/50 rounded mb-1.5 p-1">
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
            <div className="h-16 border-b border-slate-400 flex items-center justify-center bg-slate-50/50 rounded mb-1.5 p-1">
              {ticket.staff_signature ? (
                <img
                  src={ticket.staff_signature}
                  alt="Staff Signature"
                  className="max-h-14 max-w-full object-contain"
                />
              ) : ticket.staff_name ? (
                <span className="text-slate-800 font-semibold">{ticket.staff_name}</span>
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
            <div className="h-16 border-b border-slate-400 flex items-center justify-center bg-slate-50/50 rounded mb-1.5 font-bold text-slate-800 text-sm">
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
