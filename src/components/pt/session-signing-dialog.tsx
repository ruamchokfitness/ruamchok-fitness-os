'use client';

import React, { useState, useTransition } from 'react';
import { useFirebase } from '@/firebase';
import type { Firestore } from 'firebase/firestore';
import type { PTClient, PTPackage, PTTrainer, PTSession, PTCommission, PTCommissionPlan } from '@/lib/types';
import { doc, addDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { SignaturePad } from '@/components/ui/signature-pad';

interface SessionSigningDialogProps {
  client: PTClient;
  pkg: PTPackage;
  trainers: PTTrainer[];
  commissionPlans: PTCommissionPlan[];
  children: React.ReactNode;
}

const getMonthReference = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatCurrency = (amount: number) => `฿${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function SessionSigningDialog({ client, pkg, trainers, commissionPlans, children }: SessionSigningDialogProps) {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    
    const [trainerId, setTrainerId] = useState('');
    const [duration, setDuration] = useState('1');
    const [clientSignature, setClientSignature] = useState('');
    const [trainerSignature, setTrainerSignature] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!trainerId || !duration || !clientSignature || !trainerSignature) {
            toast({ title: "Information Missing", description: "Please select a trainer, duration, and provide both signatures.", variant: "destructive" });
            return;
        }

        const sessionDuration = parseFloat(duration);
        const trainer = trainers.find(t => t.id === trainerId);

        if (!trainer) {
            toast({ title: "Trainer not found", variant: "destructive"});
            return;
        }

        if ((pkg.hours_remaining ?? 0) < sessionDuration) {
            toast({ title: "Insufficient hours", description: `This package only has ${pkg.hours_remaining} hours remaining.`, variant: "destructive"});
            return;
        }

        startTransition(async () => {
            if (!db) return;
            try {
                const sessionDateTime = new Date();

                // 1. Create Session
                const sessionData: Partial<PTSession> = {
                    client_id: client.id,
                    purchase_id: pkg.id,
                    trainer_id: trainerId,
                    session_datetime: sessionDateTime.toISOString(),
                    duration_hours: sessionDuration,
                    session_status: 'completed',
                    completed_by: trainer.name,
                    completion_timestamp: sessionDateTime.toISOString(),
                    clientSignature: clientSignature,
                    trainerSignature: trainerSignature
                };
                const newSessionRef = await addDoc(collection(db, 'pt_sessions'), sessionData);
                
                // 2. Update Package
                const newHoursUsed = (pkg.hours_used || 0) + sessionDuration;
                const newHoursRemaining = pkg.hours_purchased - newHoursUsed;
                await updateDoc(doc(db, "pt_packages", pkg.id), {
                    hours_used: newHoursUsed,
                    hours_remaining: newHoursRemaining,
                    status: newHoursRemaining <= 0 ? 'completed' : 'active'
                });

                // 3. Calculate and Create Commission
                const monthRef = getMonthReference(sessionDateTime);
                const commissionsSnapshot = await getDocs(query(collection(db, "pt_commissions"), where("trainer_id", "==", trainerId), where("month_reference", "==", monthRef)));
                const commissionsInMonth = commissionsSnapshot.docs.map(d=>d.data() as PTCommission);
                const cumulativeHoursBefore = commissionsInMonth.reduce((sum, c) => sum + c.duration_hours, 0);

                let rate = 0;
                let commission = 0;
                let commissionTypeName = '';
                
                const isBoxingPackage = pkg.package_name.toLowerCase().includes('boxing');
                const boxingPlan = commissionPlans.find(p => p.id === 'BOXING');
                const trainerPlan = commissionPlans.find(p => p.id === trainer.commission_plan);

                if (isBoxingPackage && boxingPlan) {
                    rate = boxingPlan.tiers[0].rate;
                    commission = sessionDuration * rate;
                    commissionTypeName = boxingPlan.name;
                } else if (trainerPlan) {
                    commissionTypeName = trainerPlan.name;
                    if (trainerPlan.tiers.length === 1) { // Fixed rate plan
                        rate = trainerPlan.tiers[0].rate;
                        commission = sessionDuration * rate;
                    } else { // Tiered plan
                        const tier1 = trainerPlan.tiers.find(t => t.maxHours !== Infinity);
                        const tier2 = trainerPlan.tiers.find(t => t.maxHours === Infinity);
                        if(tier1 && tier2) {
                            const { maxHours: tier1Max, rate: tier1Rate } = tier1;
                            const { rate: tier2Rate } = tier2;

                            if (cumulativeHoursBefore >= tier1Max) {
                                rate = tier2Rate;
                                commission = sessionDuration * tier2Rate;
                            } else if ((cumulativeHoursBefore + sessionDuration) <= tier1Max) {
                                rate = tier1Rate;
                                commission = sessionDuration * tier1Rate;
                            } else {
                                const hoursAtTier1 = tier1Max - cumulativeHoursBefore;
                                const hoursAtTier2 = sessionDuration - hoursAtTier1;
                                commission = (hoursAtTier1 * tier1Rate) + (hoursAtTier2 * tier2Rate);
                                rate = commission / sessionDuration; // blended rate
                            }
                        }
                    }
                }
                
                const commissionData: Omit<PTCommission, 'id'> = {
                    trainer_id: trainerId,
                    session_id: newSessionRef.id,
                    duration_hours: sessionDuration,
                    hourly_rate_applied: Math.round(rate),
                    commission_amount: Math.round(commission),
                    cumulative_hours_before: cumulativeHoursBefore,
                    cumulative_hours_after: cumulativeHoursBefore + sessionDuration,
                    commission_plan: trainer.commission_plan,
                    commission_type: commissionTypeName,
                    month_reference: monthRef
                };
                await addDoc(collection(db, "pt_commissions"), commissionData);

                toast({title: "Session Completed Successfully!", description: `Commission of ${formatCurrency(commission)} created for ${trainer.name}.`});
                setOpen(false); // Close dialog on success
            } catch (error) {
                console.error("Error completing session:", error);
                toast({ title: "Error", description: "Failed to complete the session.", variant: "destructive" });
            }
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Start New Session: {client.name}</DialogTitle>
                    <DialogDescription>Package: {pkg.package_name} ({pkg.hours_remaining} hours remaining)</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="session-trainer">Trainer</Label>
                            <Select name="trainer_id" required value={trainerId} onValueChange={setTrainerId}>
                                <SelectTrigger id="session-trainer"><SelectValue placeholder="Select Trainer"/></SelectTrigger>
                                <SelectContent>
                                    {trainers.filter(t => t.status === 'active').map(t=> <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="session-duration">Duration</Label>
                            <Select name="duration_hours" defaultValue="1" required value={duration} onValueChange={setDuration}>
                            <SelectTrigger id="session-duration"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 hour</SelectItem>
                                <SelectItem value="1.5">1.5 hours</SelectItem>
                                <SelectItem value="2">2 hours</SelectItem>
                            </SelectContent>
                        </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SignaturePad label="Client Signature" onSignatureChange={setClientSignature} />
                        <SignaturePad label="Trainer Signature" onSignatureChange={setTrainerSignature} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                            Confirm & Complete Session
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
