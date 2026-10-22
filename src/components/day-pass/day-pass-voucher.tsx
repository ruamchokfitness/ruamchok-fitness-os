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

const ALL_PACKAGES: { type: DayPassPackageType; label: string; price: number }[] = [
  { type: 'Full Package', label: 'Full Package', price: 300 },
  { type: 'Full Package (SN/STD)', label: 'Full Package (SN/STD)', price: 270 },
  { type: 'Gym Only', label: 'Gym Only', price: 200 },
  { type: 'Gym Only (SN/STD)', label: 'Gym Only (SN/STD)', price: 180 },
  { type: 'Full Package (MB)', label: 'Full Package (MB)', price: 150 },
  { type: 'Gym Only (MB)', label: 'Gym Only (MB)', price: 100 },
];

export const DayPassVoucher = React.forwardRef<HTMLDivElement, DayPassVoucherProps>(
  ({ ticket, className = '', id }, ref) => {
    return (
      <div
        ref={ref}
        id={id}
        className={`bg-white text-slate-900 font-sans p-6 border-2 border-slate-300 rounded-lg shadow-sm print:shadow-none print:border-none print:p-2 w-full max-w-[1050px] mx-auto text-xs ${className}`}
        style={{ minWidth: '850px' }}
      >
        <div className="grid grid-cols-[1fr_auto_1.4fr] gap-4 items-stretch">
          {/* ================= LEFT SIDE: CLUB STUB (ต้นขั้วสำหรับฟิตเนส) ================= */}
          <div className="flex flex-col justify-between border-2 border-slate-800 rounded-md p-3.5 bg-slate-50/50">
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-300 gap-2">
                <img
                  src={RCF_DAY_PASS_LOGO}
                  alt="Ruamchok Fitness Logo"
                  className="h-9 object-contain"
                />
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    ต้นขั้วสำหรับฟิตเนส / CLUB STUB
                  </span>
                  <span className="font-mono font-black text-red-600 text-sm tracking-wide">
                    No. {ticket.ticket_no || 'DP09770'}
                  </span>
                </div>
              </div>

              {/* Title & Date */}
              <div className="flex items-center justify-between mt-2 mb-2 font-medium text-slate-700">
                <span className="font-bold text-slate-900 text-[13px]">ONE DAY PASS</span>
                <span>วันที่ / Date: {ticket.date}</span>
              </div>

              {/* Customer Info */}
              <div className="space-y-1.5 bg-white p-2 rounded border border-slate-200">
                <div className="flex items-baseline">
                  <span className="font-semibold text-slate-700 w-28 shrink-0">
                    Full Name / ชื่อ-สกุล:
                  </span>
                  <span className="font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 pl-1">
                    {ticket.client_name || '-'}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="font-semibold text-slate-700 w-28 shrink-0">
                    Phone / เบอร์โทร:
                  </span>
                  <span className="font-medium text-slate-800 border-b border-dotted border-slate-400 flex-1 pl-1">
                    {ticket.phone || '-'}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="font-semibold text-slate-700 w-28 shrink-0">
                    Locker No.:
                  </span>
                  <span className="font-bold text-indigo-700 border-b border-dotted border-slate-400 flex-1 pl-1">
                    {ticket.locker_no || '-'}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="mt-2.5 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  การชำระเงิน / Payment Method:
                </span>
                <div className="flex gap-3 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-default">
                    <span
                      className={`inline-block w-3.5 h-3.5 border rounded-sm flex items-center justify-center font-bold text-[10px] ${
                        ticket.payment_method === 'cash'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {ticket.payment_method === 'cash' ? '✓' : ''}
                    </span>
                    Cash
                  </label>
                  <label className="flex items-center gap-1.5 cursor-default">
                    <span
                      className={`inline-block w-3.5 h-3.5 border rounded-sm flex items-center justify-center font-bold text-[10px] ${
                        ticket.payment_method === 'transfer'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {ticket.payment_method === 'transfer' ? '✓' : ''}
                    </span>
                    Transfer / QR
                  </label>
                  <label className="flex items-center gap-1.5 cursor-default">
                    <span
                      className={`inline-block w-3.5 h-3.5 border rounded-sm flex items-center justify-center font-bold text-[10px] ${
                        ticket.payment_method === 'credit_card'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {ticket.payment_method === 'credit_card' ? '✓' : ''}
                    </span>
                    Credit Card
                  </label>
                </div>
              </div>

              {/* Package Selection List */}
              <div className="mt-2.5 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  ประเภทแพ็กเกจ / Package:
                </span>
                <div className="grid grid-cols-2 gap-1 text-[10.5px]">
                  {ALL_PACKAGES.map((pkg) => {
                    const isSelected = ticket.package_type === pkg.type;
                    return (
                      <div
                        key={pkg.type}
                        className={`flex items-center justify-between px-1.5 py-0.5 rounded border ${
                          isSelected
                            ? 'bg-amber-100 border-amber-400 font-bold text-slate-900'
                            : 'border-transparent text-slate-600'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <span
                            className={`w-3 h-3 border rounded-sm inline-flex items-center justify-center text-[9px] font-bold ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          {pkg.label}
                        </span>
                        <span className="font-semibold">฿{pkg.price}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Stub Signatures */}
            <div className="mt-3 pt-2 border-t border-slate-300 grid grid-cols-2 gap-2 text-center text-[10px]">
              <div>
                <div className="h-12 border-b border-slate-400 flex items-center justify-center bg-white rounded mb-1">
                  {ticket.client_signature ? (
                    <img
                      src={ticket.client_signature}
                      alt="Member Signature"
                      className="max-h-11 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-slate-300 italic">ลายเซ็นสมาชิก</span>
                  )}
                </div>
                <span className="text-slate-600 font-medium">ลายเซ็นสมาชิก / Member</span>
              </div>

              <div>
                <div className="h-12 border-b border-slate-400 flex items-center justify-center bg-white rounded mb-1">
                  {ticket.staff_signature ? (
                    <img
                      src={ticket.staff_signature}
                      alt="Staff Signature"
                      className="max-h-11 max-w-full object-contain"
                    />
                  ) : ticket.staff_name ? (
                    <span className="text-slate-700 font-medium">{ticket.staff_name}</span>
                  ) : (
                    <span className="text-slate-300 italic">ลายเซ็นพนักงาน</span>
                  )}
                </div>
                <span className="text-slate-600 font-medium">พนักงานขาย / Staff</span>
              </div>
            </div>
          </div>

          {/* ================= VERTICAL CUT LINE (รอยปรุตัดบัตร) ================= */}
          <div className="flex flex-col items-center justify-between py-2 text-slate-400 select-none">
            <span className="text-sm">✂</span>
            <div className="w-px flex-1 border-r-2 border-dashed border-slate-400 my-1"></div>
            <span className="text-[10px] rotate-90 my-3 font-mono tracking-widest uppercase">
              CUT LINE
            </span>
            <div className="w-px flex-1 border-r-2 border-dashed border-slate-400 my-1"></div>
            <span className="text-sm">✂</span>
          </div>

          {/* ================= RIGHT SIDE: CUSTOMER PASS (หางบัตรสำหรับลูกค้า) ================= */}
          <div className="flex flex-col justify-between border-2 border-slate-800 rounded-md p-4 bg-white relative">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b-2 border-slate-800 gap-3">
                <div className="flex items-center gap-2">
                  <img
                    src={RCF_DAY_PASS_LOGO}
                    alt="Ruamchok Fitness Logo"
                    className="h-10 object-contain"
                  />
                  <div>
                    <h2 className="font-black text-sm text-slate-900 tracking-wide uppercase">
                      RUAMCHOK FITNESS
                    </h2>
                    <span className="inline-block bg-slate-900 text-white font-bold text-[10px] px-2 py-0.5 rounded tracking-wider">
                      ONE DAY PASS
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-black text-red-600 text-base tracking-wider block">
                    No. {ticket.ticket_no || 'DP09770'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600">
                    วันที่ / Date: {ticket.date}
                  </span>
                </div>
              </div>

              {/* Customer Details Box */}
              <div className="grid grid-cols-[1.5fr_1fr] gap-3 mt-3 bg-slate-50 p-2.5 rounded border border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex items-baseline">
                    <span className="font-semibold text-slate-700 w-32 shrink-0">
                      Full Name / ชื่อ-สกุล:
                    </span>
                    <span className="font-bold text-slate-900 text-sm border-b border-dotted border-slate-400 flex-1 pl-1">
                      {ticket.client_name || '-'}
                    </span>
                  </div>

                  <div className="flex items-baseline">
                    <span className="font-semibold text-slate-700 w-32 shrink-0">
                      Phone / เบอร์โทร:
                    </span>
                    <span className="font-medium text-slate-800 border-b border-dotted border-slate-400 flex-1 pl-1">
                      {ticket.phone || '-'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pl-2 border-l border-slate-200">
                  <div className="flex items-baseline">
                    <span className="font-semibold text-slate-700 w-20 shrink-0">
                      Locker No.:
                    </span>
                    <span className="font-black text-indigo-700 text-sm border-b border-dotted border-slate-400 flex-1 pl-1">
                      {ticket.locker_no || '-'}
                    </span>
                  </div>

                  <div className="flex items-baseline">
                    <span className="font-semibold text-slate-700 w-20 shrink-0">
                      Package:
                    </span>
                    <span className="font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 pl-1">
                      {ticket.package_type || '-'} (฿{ticket.price || 0})
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Section (Direct from Day Pass.docx) */}
              <div className="mt-3 p-2.5 bg-amber-50/70 border border-amber-200 rounded text-[10px] space-y-1.5 leading-relaxed text-slate-700">
                <div className="font-bold text-slate-900 text-[10.5px] border-b border-amber-200/80 pb-0.5">
                  ข้อกำหนดการใช้บริการ / Ruamchok Fitness Policy
                </div>
                <div>
                  <p className="font-medium text-slate-800">
                    • รวมโชค ฟิตเนสขอสงวนสิทธิ์ไม่รับผิดชอบต่อทรัพย์สินที่สูญหายหรือถูกโจรกรรม
                  </p>
                  <p className="text-slate-600 italic">
                    Ruamchok Fitness is not responsible for lost or stolen items.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-800">
                    • รวมโชค ฟิตเนสไม่รับผิดชอบต่อการบาดเจ็บหรือความเสียหายใด ๆ ที่อาจเกิดขึ้นระหว่างการใช้บริการ กรุณาปรึกษาแพทย์ก่อนใช้บริการหากมีปัญหาสุขภาพ
                  </p>
                  <p className="text-slate-600 italic">
                    Ruamchok Fitness is not liable for any injury or damage that may occur during your visit. Please consult your doctor if you have any health concerns.
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Pass Signatures */}
            <div className="mt-4 pt-2 border-t border-slate-300 grid grid-cols-3 gap-3 text-center text-[10.5px]">
              <div>
                <div className="h-14 border-b border-slate-400 flex items-center justify-center bg-slate-50/80 rounded mb-1">
                  {ticket.client_signature ? (
                    <img
                      src={ticket.client_signature}
                      alt="Member Signature"
                      className="max-h-12 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-slate-300 italic text-[10px]">ลายเซ็นสมาชิก</span>
                  )}
                </div>
                <span className="text-slate-700 font-medium">
                  ลายเซ็นสมาชิก / Member's Signature
                </span>
              </div>

              <div>
                <div className="h-14 border-b border-slate-400 flex items-center justify-center bg-slate-50/80 rounded mb-1">
                  {ticket.staff_signature ? (
                    <img
                      src={ticket.staff_signature}
                      alt="Staff Signature"
                      className="max-h-12 max-w-full object-contain"
                    />
                  ) : ticket.staff_name ? (
                    <span className="text-slate-800 font-semibold">{ticket.staff_name}</span>
                  ) : (
                    <span className="text-slate-300 italic text-[10px]">ลายเซ็นพนักงาน</span>
                  )}
                </div>
                <span className="text-slate-700 font-medium">
                  ลายเซ็นพนักงานขาย / Staff Signature
                </span>
              </div>

              <div>
                <div className="h-14 border-b border-slate-400 flex items-center justify-center bg-slate-50/80 rounded mb-1 font-bold text-slate-800 text-xs">
                  {ticket.date}
                </div>
                <span className="text-slate-700 font-medium">วันที่ / Date</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DayPassVoucher.displayName = 'DayPassVoucher';
