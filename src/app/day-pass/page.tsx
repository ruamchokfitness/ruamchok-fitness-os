'use client';

import React, { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import Link from 'next/link';
import {
  collection,
  doc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useUser } from '@/firebase';
import type { DayPassTicket, DayPassPackageType, DayPassPaymentMethod } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignaturePad } from '@/components/ui/signature-pad';
import { DayPassVoucher } from '@/components/day-pass/day-pass-voucher';
import { DayPassPreviewDialog } from '@/components/day-pass/day-pass-preview-dialog';
import { exportVoucherToPdf } from '@/lib/day-pass-pdf';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Ticket,
  Download,
  Search,
  Trash2,
  Eye,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  RotateCcw,
  Settings,
  History,
  PlusCircle,
  Loader2,
  UserCheck,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';

const PACKAGES: { type: DayPassPackageType; label: string; price: number; desc: string }[] = [
  {
    type: 'Daily Full Membership',
    label: 'Daily Full Membership',
    price: 300,
    desc: 'All-access pass including gym facilities and group classes.',
  },
  {
    type: 'Daily Standard Membership',
    label: 'Daily Standard Membership',
    price: 200,
    desc: 'Access to gym fitness facilities only.',
  },
  {
    type: 'Daily Full Membership (SN/STD)',
    label: 'Daily Full Membership (SN/STD)',
    price: 270,
    desc: 'Full pass for Seniors (60+) or Students with valid ID.',
  },
  {
    type: 'Daily Standard Membership (SN/STD)',
    label: 'Daily Standard Membership (SN/STD)',
    price: 180,
    desc: 'Standard pass for Seniors (60+) or Students with valid ID.',
  },
];

export default function DayPassPage() {
  const { firestore: db } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Active Tab
  const [activeTab, setActiveTab] = useState('new');

  // Sequence state from Firestore
  const [sequenceData, setSequenceData] = useState<{ prefix: string; next_seq: number; padding: number }>({
    prefix: 'DP',
    next_seq: 9770,
    padding: 5,
  });
  const [isLoadingSeq, setIsLoadingSeq] = useState(true);

  // Form Fields
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [lockerNo, setLockerNo] = useState('');
  const [packageType, setPackageType] = useState<DayPassPackageType>('Daily Full Membership');
  const [paymentMethod, setPaymentMethod] = useState<DayPassPaymentMethod>('cash');
  const [ticketDate, setTicketDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [clientSignature, setClientSignature] = useState('');
  const [staffSignature, setStaffSignature] = useState('');
  const [staffName, setStaffName] = useState(user?.displayName || user?.email?.split('@')[0] || 'Staff');

  // Modal / Preview state
  const [previewTicket, setPreviewTicket] = useState<DayPassTicket | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Hidden voucher ref for immediate export
  const hiddenVoucherRef = useRef<HTMLDivElement>(null);

  // Settings tab form state
  const [settingsNextSeq, setSettingsNextSeq] = useState('9770');
  const [settingsPrefix, setSettingsPrefix] = useState('DP');
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Delete Confirmation state
  const [ticketToDelete, setTicketToDelete] = useState<DayPassTicket | null>(null);

  // History Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  // Update staff name if user loads
  useEffect(() => {
    if (user && (!staffName || staffName === 'Staff')) {
      setStaffName(user.displayName || user.email?.split('@')[0] || 'Staff');
    }
  }, [user]);

  // Listen to Sequence settings in real time
  useEffect(() => {
    if (!db) return;
    const seqRef = doc(db, 'app_settings', 'day_pass_sequence');
    const unsub = onSnapshot(seqRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const nextSeq = data.next_seq ?? 9770;
        const prefix = data.prefix ?? 'DP';
        const padding = data.padding ?? 5;
        setSequenceData({ prefix, next_seq: nextSeq, padding });
        setSettingsNextSeq(String(nextSeq));
        setSettingsPrefix(prefix);
      } else {
        // Defaults to DP09770
        setSequenceData({ prefix: 'DP', next_seq: 9770, padding: 5 });
        setSettingsNextSeq('9770');
        setSettingsPrefix('DP');
      }
      setIsLoadingSeq(false);
    });

    return () => unsub();
  }, [db]);

  // Calculated next ticket number
  const nextTicketNumber = useMemo(() => {
    const seqStr = String(sequenceData.next_seq).padStart(sequenceData.padding, '0');
    return `${sequenceData.prefix}${seqStr}`;
  }, [sequenceData]);

  // Selected package details
  const selectedPackage = useMemo(() => {
    return PACKAGES.find((p) => p.type === packageType) || PACKAGES[0];
  }, [packageType]);

  // Fetch tickets history
  const ticketsQuery = useMemoFirebase(
    () => (db ? query(collection(db, 'day_pass_tickets'), orderBy('created_at', 'desc')) : null),
    [db]
  );
  const { data: tickets, isLoading: isLoadingTickets } = useCollection<DayPassTicket>(ticketsQuery);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.ticket_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.phone && t.phone.includes(searchQuery)) ||
        (t.locker_no && t.locker_no.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchPayment = filterPayment === 'all' || t.payment_method === filterPayment;
      const matchDate = !filterDate || t.date === filterDate;

      return matchSearch && matchPayment && matchDate;
    });
  }, [tickets, searchQuery, filterPayment, filterDate]);

  // Stats calculation
  const stats = useMemo(() => {
    if (!tickets) return { todayCount: 0, todayRevenue: 0, totalCount: 0, totalRevenue: 0 };
    const today = new Date().toISOString().split('T')[0];
    let todayCount = 0;
    let todayRevenue = 0;
    let totalCount = tickets.length;
    let totalRevenue = 0;

    tickets.forEach((t) => {
      const price = Number(t.price) || 0;
      totalRevenue += price;
      if (t.date === today) {
        todayCount += 1;
        todayRevenue += price;
      }
    });

    return { todayCount, todayRevenue, totalCount, totalRevenue };
  }, [tickets]);

  // Reset form
  const handleResetForm = () => {
    setClientName('');
    setPhone('');
    setLockerNo('');
    setPackageType('Daily Full Membership');
    setPaymentMethod('cash');
    setTicketDate(new Date().toISOString().split('T')[0]);
    setClientSignature('');
    setStaffSignature('');
  };

  // Submit and Save Day Pass
  const handleSaveAndExport = async () => {
    if (!db) return;

    if (!clientName.trim()) {
      toast({
        title: 'กรุณากรอกชื่อลูกค้า',
        description: 'กรุณากรอก Full Name / ชื่อ-สกุล ของลูกค้า',
        variant: 'destructive',
      });
      return;
    }

    if (!clientSignature) {
      toast({
        title: 'กรุณาเซ็นชื่อ',
        description: 'กรุณาให้ลูกค้าเซ็นชื่อในช่อง Member Signature ก่อนบันทึก',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      let createdTicket: DayPassTicket | null = null;

      // Use Firestore transaction for safe sequential number assignment
      await runTransaction(db, async (transaction) => {
        const seqRef = doc(db, 'app_settings', 'day_pass_sequence');
        const seqSnap = await transaction.get(seqRef);

        let currentSeq = 9770;
        let prefix = 'DP';
        let padding = 5;

        if (seqSnap.exists()) {
          const sData = seqSnap.data();
          currentSeq = Number(sData.next_seq) || 9770;
          prefix = sData.prefix || 'DP';
          padding = Number(sData.padding) || 5;
        } else {
          // Initialize sequence
          transaction.set(seqRef, {
            prefix: 'DP',
            next_seq: 9771,
            padding: 5,
            updated_at: serverTimestamp(),
          });
        }

        const formattedNo = `${prefix}${String(currentSeq).padStart(padding, '0')}`;
        const newTicketRef = doc(collection(db, 'day_pass_tickets'));

        const newTicketData: Omit<DayPassTicket, 'id'> = {
          ticket_no: formattedNo,
          seq_number: currentSeq,
          date: ticketDate,
          client_name: clientName.trim(),
          phone: phone.trim(),
          locker_no: lockerNo.trim() || '-',
          package_type: packageType,
          price: selectedPackage.price,
          payment_method: paymentMethod,
          client_signature: clientSignature,
          staff_signature: staffSignature,
          staff_name: staffName,
          created_at: serverTimestamp(),
        };

        transaction.set(newTicketRef, newTicketData);

        // Increment sequence
        transaction.update(seqRef, {
          next_seq: currentSeq + 1,
          updated_at: serverTimestamp(),
        });

        createdTicket = {
          ...newTicketData,
          id: newTicketRef.id,
        };
      });

      if (createdTicket) {
        toast({
          title: `สร้างคูปองสำเร็จ เลขที่ ${(createdTicket as DayPassTicket).ticket_no}`,
          description: 'กำลังดาวน์โหลดไฟล์ PDF สำหรับจัดเก็บใน Google Drive...',
        });

        // Open preview dialog
        setPreviewTicket(createdTicket);
        setPreviewOpen(true);

        // Auto download PDF from hidden voucher ref
        setTimeout(async () => {
          if (hiddenVoucherRef.current && createdTicket) {
            try {
              await exportVoucherToPdf(
                hiddenVoucherRef.current,
                createdTicket.ticket_no,
                createdTicket.client_name
              );
            } catch (err) {
              console.error('Auto download PDF error:', err);
            }
          }
        }, 300);

        // Clear form for the next customer
        handleResetForm();
      }
    } catch (error) {
      console.error('Error saving Day Pass:', error);
      toast({
        title: 'เกิดข้อผิดพลาดในการบันทึก',
        description: 'ไม่สามารถบันทึกคูปองได้ กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete ticket
  const confirmDeleteTicket = async () => {
    if (!ticketToDelete || !db) return;
    try {
      await deleteDoc(doc(db, 'day_pass_tickets', ticketToDelete.id));
      toast({
        title: 'ลบคูปองสำเร็จ',
        description: `ลบคูปองเลขที่ ${ticketToDelete.ticket_no} เรียบร้อยแล้ว`,
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'เกิดข้อผิดพลาดในการลบ',
        variant: 'destructive',
      });
    } finally {
      setTicketToDelete(null);
    }
  };

  // Update Settings (Sequence number)
  const handleSaveSettings = async () => {
    if (!db) return;
    const nextSeqNum = parseInt(settingsNextSeq, 10);
    if (isNaN(nextSeqNum) || nextSeqNum <= 0) {
      toast({
        title: 'เลขรันไม่ถูกต้อง',
        description: 'กรุณาระบุเลขลำดับเป็นตัวเลขจำนวนเต็มบวก',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingSettings(true);
    try {
      const seqRef = doc(db, 'app_settings', 'day_pass_sequence');
      await setDoc(
        seqRef,
        {
          prefix: settingsPrefix.trim().toUpperCase() || 'DP',
          next_seq: nextSeqNum,
          padding: 5,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: 'บันทึกการตั้งค่าสำเร็จ',
        description: `เลขรันถัดไปถูกเปลี่ยนเป็น ${settingsPrefix.trim().toUpperCase()}${String(
          nextSeqNum
        ).padStart(5, '0')}`,
      });
    } catch (error) {
      console.error('Settings update error:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกการตั้งค่าได้',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/50 pb-16">
      {/* ================= HEADER (SUBTLE, CALM THEME) ================= */}
      <header className="bg-slate-900 text-white py-4 md:py-5 border-b border-slate-800 shadow-sm print:hidden">
        <div className="container mx-auto px-4 md:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                variant="outline"
                size="icon"
                className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 h-9 w-9 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-slate-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Day Pass Coupon</h1>
                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono font-semibold px-2 py-0.5 rounded">
                  No. {nextTicketNumber}
                </span>
              </div>
              <p className="text-slate-400 text-xs md:text-sm">
                Daily pass coupon for Ruamchok Fitness.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-lg px-3 py-1.5 text-right hidden sm:block">
              <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                ออกวันนี้ / Today
              </span>
              <span className="text-sm font-bold text-slate-200 font-mono">
                {stats.todayCount} ใบ (฿{stats.todayRevenue.toLocaleString()})
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="container mx-auto px-4 md:px-8 mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1 shadow-sm rounded-xl grid grid-cols-3 max-w-md print:hidden">
            <TabsTrigger
              value="new"
              className="gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white text-xs md:text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              ออกคูปองใหม่
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white text-xs md:text-sm"
            >
              <History className="w-4 h-4" />
              ประวัติ ({tickets ? tickets.length : 0})
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="gap-2 data-[state=active]:bg-slate-900 data-[state=active]:text-white text-xs md:text-sm"
            >
              <Settings className="w-4 h-4" />
              ตั้งค่าเลขรัน
            </TabsTrigger>
          </TabsList>

          {/* ================= TAB 1: NEW COUPON FORM ================= */}
          <TabsContent value="new" className="space-y-6">
            {/* Subtle Sleek Ticket Number Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-mono font-bold">
                  DP
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    เลขที่คูปองที่จะออก (Next Ticket No.)
                  </span>
                  <span className="text-2xl md:text-3xl font-black font-mono text-slate-900 tracking-wider">
                    {nextTicketNumber}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs md:text-sm bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg text-slate-700">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>วันที่ออกคูปอง: <strong className="font-semibold text-slate-900">{ticketDate}</strong></span>
              </div>
            </div>

            {/* FORM CONTAINER - ORDERED PRECISELY AS REQUESTED */}
            <div className="max-w-4xl mx-auto space-y-6">
              {/* ================= SECTION A: CUSTOMER FACING ================= */}
              <div className="space-y-5">
                {/* 1. ข้อมูลลูกค้า (Customer Details) */}
                <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden bg-white">
                  <CardHeader className="bg-slate-50 border-b border-slate-200/80 py-3.5 px-5">
                    <CardTitle className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">
                        1
                      </span>
                      1. ข้อมูลลูกค้า (Customer Details)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="clientName" className="font-semibold text-slate-800 text-sm">
                        Full Name / ชื่อ-สกุลลูกค้า: <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="clientName"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="เช่น นายรักสุขภาพ มั่นคง หรือ John Doe"
                        className="text-base py-5 border-slate-300 focus-visible:ring-slate-700 bg-white rounded-lg"
                      />
                    </div>

                    {/* Phone & Locker No */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="font-semibold text-slate-800 text-sm">
                          Phone / เบอร์โทรศัพท์: <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="เช่น 081-234-5678"
                          className="text-base py-5 border-slate-300 focus-visible:ring-slate-700 bg-white rounded-lg font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="lockerNo" className="font-semibold text-slate-800 text-sm">
                          Locker No. (หมายเลขล็อกเกอร์):
                        </Label>
                        <Input
                          id="lockerNo"
                          value={lockerNo}
                          onChange={(e) => setLockerNo(e.target.value)}
                          placeholder="เช่น L-05 หรือ 12"
                          className="text-base py-5 border-slate-300 focus-visible:ring-slate-700 rounded-lg font-mono"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ข้อกำหนดการใช้บริการ / Ruamchok Fitness Policy 2 ภาษา */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5 text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-2 text-xs border-b border-slate-200 pb-1.5">
                    <ShieldCheck className="w-4 h-4 text-slate-700" />
                    ข้อกำหนดการใช้บริการ / Ruamchok Fitness Policy
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      1. รวมโชค ฟิตเนสขอสงวนสิทธิ์ไม่รับผิดชอบต่อทรัพย์สินที่สูญหายหรือถูกโจรกรรม
                    </p>
                    <p className="text-slate-600 italic pl-3">
                      Ruamchok Fitness is not responsible for lost or stolen items.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      2. รวมโชค ฟิตเนสไม่รับผิดชอบต่อการบาดเจ็บหรือความเสียหายใด ๆ ที่อาจเกิดขึ้นระหว่างการใช้บริการ กรุณาปรึกษาแพทย์ก่อนใช้บริการหากมีปัญหาสุขภาพ
                    </p>
                    <p className="text-slate-600 italic pl-3">
                      Ruamchok Fitness is not liable for any injury or damage that may occur during your visit. Please consult your doctor if you have any health concerns.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      3. สมาชิกและผู้ใช้บริการต้องปฏิบัติตามกฎระเบียบของฟิตเนส สวมใส่ชุดและรองเท้ากีฬาที่เหมาะสมขณะออกกำลังกาย
                    </p>
                    <p className="text-slate-600 italic pl-3">
                      Guests must comply with fitness rules and wear appropriate athletic attire and footwear at all times.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-800">
                      4. คูปองนี้ใช้ได้เฉพาะบุคคลและมีอายุการใช้งานภายในวันที่ระบุเท่านั้น ไม่สามารถโอนสิทธิ์หรือขอคืนเงินได้
                    </p>
                    <p className="text-slate-600 italic pl-3">
                      This day pass is non-refundable, non-transferable, and valid only on the date of issuance.
                    </p>
                  </div>
                </div>

                {/* 2. ลายเซ็นสมาชิก / Member's Signature */}
                <Card className="shadow-sm border-slate-300 rounded-xl overflow-hidden bg-white">
                  <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-5">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">
                          2
                        </span>
                        2. ลายเซ็นสมาชิก / Member's Signature
                      </span>
                      <span className="text-xs text-slate-500 font-normal">
                        (ลูกค้ารับทราบข้อกำหนดและเซ็นชื่อที่นี่)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 md:p-5">
                    <SignaturePad
                      label=""
                      onSignatureChange={setClientSignature}
                      className="w-full"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* ================= SECTION B: STAFF ONLY ================= */}
              <div className="pt-4 border-t-2 border-dashed border-slate-300 space-y-5">
                {/* Staff Section Divider Banner */}
                <div className="bg-slate-800 text-slate-200 px-4 py-2.5 rounded-lg flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-white">
                    <UserCheck className="w-4 h-4 text-slate-300" />
                    ส่วนสำหรับเจ้าหน้าที่ / Staff Only (พนักงานเป็นผู้เลือกและบันทึก)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    เจ้าหน้าที่: <strong>{staffName}</strong>
                  </span>
                </div>

                {/* 3. เลือกประเภทแพ็กเกจ (Package Options) */}
                <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden bg-white">
                  <CardHeader className="bg-slate-50 border-b border-slate-200/80 py-3.5 px-5">
                    <CardTitle className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-bold">
                        3
                      </span>
                      3. เลือกประเภทแพ็กเกจ (Package Options)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {PACKAGES.map((pkg) => {
                        const isSelected = packageType === pkg.type;
                        return (
                          <div
                            key={pkg.type}
                            onClick={() => setPackageType(pkg.type)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                              isSelected
                                ? 'border-slate-900 bg-slate-50 shadow-sm'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-slate-900 text-sm">
                                {pkg.label}
                              </span>
                              <span
                                className={`text-sm font-black px-2.5 py-0.5 rounded ${
                                  isSelected
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                ฿{pkg.price}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-snug">{pkg.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* 4. ช่องทางชำระเงิน (Payment Method) */}
                <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden bg-white">
                  <CardHeader className="bg-slate-50 border-b border-slate-200/80 py-3.5 px-5">
                    <CardTitle className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-bold">
                        4
                      </span>
                      4. ช่องทางชำระเงิน (Payment Method)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-3 gap-3">
                      {/* Cash */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                          paymentMethod === 'cash'
                            ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <Banknote className={`w-5 h-5 ${paymentMethod === 'cash' ? 'text-white' : 'text-slate-600'}`} />
                        <span className="text-xs md:text-sm font-medium">Cash (เงินสด)</span>
                      </button>

                      {/* Transfer / QR */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('transfer')}
                        className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                          paymentMethod === 'transfer'
                            ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <QrCode className={`w-5 h-5 ${paymentMethod === 'transfer' ? 'text-white' : 'text-slate-600'}`} />
                        <span className="text-xs md:text-sm font-medium">Transfer / QR</span>
                      </button>

                      {/* Credit Card */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('credit_card')}
                        className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                          paymentMethod === 'credit_card'
                            ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <CreditCard className={`w-5 h-5 ${paymentMethod === 'credit_card' ? 'text-white' : 'text-slate-600'}`} />
                        <span className="text-xs md:text-sm font-medium">Credit Card</span>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* 5. ลายเซ็นพนักงานขาย / Staff Signature */}
                <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden bg-white">
                  <CardHeader className="bg-slate-50 border-b border-slate-200/80 py-3.5 px-5">
                    <CardTitle className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-bold">
                        5
                      </span>
                      5. ลายเซ็นพนักงานขาย / Staff Signature
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="staffName" className="text-xs font-medium text-slate-600">
                        ชื่อพนักงานผู้รับเงิน / ออกคูปอง:
                      </Label>
                      <Input
                        id="staffName"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="ชื่อพนักงาน"
                        className="text-sm h-10 rounded-lg max-w-sm"
                      />
                    </div>
                    <SignaturePad
                      label="ลายเซ็นพนักงาน (Staff Signature):"
                      onSignatureChange={setStaffSignature}
                      className="w-full"
                    />
                  </CardContent>
                </Card>

                {/* Submit Action Bar */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={handleSaveAndExport}
                    disabled={isSaving}
                    className="flex-1 py-6 text-sm md:text-base font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl gap-2 active:scale-[0.99]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        กำลังบันทึกและสร้าง PDF...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        บันทึกและดาวน์โหลด PDF สำหรับ Google Drive
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    type="button"
                    onClick={handleResetForm}
                    className="py-6 px-6 rounded-xl text-slate-600 hover:bg-slate-100 gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    ล้างฟอร์ม (Reset)
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ================= TAB 2: HISTORY LIST ================= */}
          <TabsContent value="history" className="space-y-4">
            {/* Search and Filters Bar */}
            <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="ค้นหาตามเลข No., ชื่อลูกค้า, เบอร์โทร..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 rounded-lg"
                    />
                  </div>

                  <div>
                    <select
                      value={filterPayment}
                      onChange={(e) => setFilterPayment(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">ทุกช่องทางชำระเงิน</option>
                      <option value="cash">เงินสด (Cash)</option>
                      <option value="transfer">โอนเงิน (Transfer/QR)</option>
                      <option value="credit_card">บัตรเครดิต (Credit Card)</option>
                    </select>
                  </div>

                  <div>
                    <Input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tickets Table */}
            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">เลขที่คูปอง (No.)</th>
                      <th className="py-3 px-4">วันที่</th>
                      <th className="py-3 px-4">ชื่อลูกค้า</th>
                      <th className="py-3 px-4">เบอร์โทร</th>
                      <th className="py-3 px-4">ล็อกเกอร์</th>
                      <th className="py-3 px-4">แพ็กเกจ</th>
                      <th className="py-3 px-4 text-right">ราคา</th>
                      <th className="py-3 px-4">ชำระเงิน</th>
                      <th className="py-3 px-4">ลายเซ็น</th>
                      <th className="py-3 px-4 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingTickets ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                          กำลังโหลดข้อมูลประวัติคูปอง...
                        </td>
                      </tr>
                    ) : filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          ไม่พบรายการคูปองที่ค้นหา
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-red-600">
                            {ticket.ticket_no}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            {ticket.date}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {ticket.client_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 text-xs">
                            {ticket.phone || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 font-bold">
                            {ticket.locker_no || '-'}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-700">
                            {ticket.package_type}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            ฿{(ticket.price || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                              {ticket.payment_method === 'cash'
                                ? 'Cash'
                                : ticket.payment_method === 'transfer'
                                ? 'QR/Transfer'
                                : 'Credit Card'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {ticket.client_signature ? (
                              <img
                                src={ticket.client_signature}
                                alt="Signature"
                                className="h-6 w-16 object-contain bg-white border rounded"
                              />
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewTicket(ticket);
                                setPreviewOpen(true);
                              }}
                              className="h-8 gap-1 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              ดู / PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setTicketToDelete(ticket)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ================= TAB 3: SETTINGS ================= */}
          <TabsContent value="settings" className="space-y-6 max-w-xl mx-auto">
            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-700" />
                  ตั้งค่าเลขที่คูปอง (Running Number Sequence)
                </CardTitle>
                <CardDescription className="text-xs">
                  กำหนดคำนำหน้า (Prefix) และเลขลำดับที่จะออกในใบถัดไป
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    ตัวอย่างเลขที่คูปองใบถัดไปที่จะออก:
                  </span>
                  <span className="text-2xl font-black font-mono text-slate-900">
                    {settingsPrefix.trim().toUpperCase() || 'DP'}
                    {String(settingsNextSeq || 9770).padStart(5, '0')}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settingsPrefix" className="font-semibold text-sm">
                    คำนำหน้า (Prefix):
                  </Label>
                  <Input
                    id="settingsPrefix"
                    value={settingsPrefix}
                    onChange={(e) => setSettingsPrefix(e.target.value)}
                    placeholder="เช่น DP"
                    className="font-mono rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settingsNextSeq" className="font-semibold text-sm">
                    เลขลำดับถัดไป (Next Sequence Number):
                  </Label>
                  <Input
                    id="settingsNextSeq"
                    type="number"
                    value={settingsNextSeq}
                    onChange={(e) => setSettingsNextSeq(e.target.value)}
                    placeholder="เช่น 9770"
                    className="font-mono rounded-lg"
                  />
                  <p className="text-xs text-slate-500">
                    * ระบบจะจัดรูปแบบ 5 หลักอัตโนมัติ เช่น 9770 จะแสดงเป็น 09770
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isUpdatingSettings}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-5 rounded-lg"
                  >
                    {isUpdatingSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      'บันทึกการตั้งค่าเลขรัน'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Hidden Voucher container for immediate direct PDF generation */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        <DayPassVoucher
          ref={hiddenVoucherRef}
          ticket={{
            ticket_no: nextTicketNumber,
            client_name: clientName,
            phone: phone,
            locker_no: lockerNo,
            package_type: packageType,
            price: selectedPackage.price,
            payment_method: paymentMethod,
            date: ticketDate,
            client_signature: clientSignature,
            staff_signature: staffSignature,
            staff_name: staffName,
          }}
        />
      </div>

      {/* Preview and Download Dialog */}
      <DayPassPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        ticket={previewTicket}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={!!ticketToDelete}
        onOpenChange={(open) => !open && setTicketToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบคูปอง?</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบคูปองเลขที่{' '}
              <strong className="text-slate-900">{ticketToDelete?.ticket_no}</strong> (ลูกค้า:{' '}
              {ticketToDelete?.client_name})? การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTicket}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
