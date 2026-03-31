'use client';

import React, { useState, useTransition } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useFirebase } from '@/firebase';
import type { PTClient, PTPackage, PTTrainer, PTSession, PTCommission, PTCommissionPlan } from '@/lib/types';
import { doc, addDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { SignaturePad } from '@/components/ui/signature-pad';
import { ScrollArea } from '../ui/scroll-area';

interface SessionSigningDialogProps {
  client: PTClient;
  pkg: PTPackage;
  trainers: PTTrainer[];
  commissionPlans: PTCommissionPlan[];
  children: React.ReactNode;
}

const getMonthReference = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const formatCurrency = (amount: number) => `฿${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;


const formSchema = z.object({
    trainerId: z.string().min(1, "Trainer is required."),
    duration: z.string(),
    clientSignature: z.string().min(1, { message: "Client signature is required." }),
    trainerSignature: z.string().min(1, { message: "Trainer signature is required." }),
});

export function SessionSigningDialog({ client, pkg, trainers, commissionPlans, children }: SessionSigningDialogProps) {
    const { firestore: db } = useFirebase();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    const { control, handleSubmit, formState: { errors }, reset } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            duration: '1',
            trainerId: '',
            clientSignature: '',
            trainerSignature: '',
        }
    });

    const processSubmit = async (data: z.infer<typeof formSchema>) => {
        const sessionDuration = parseFloat(data.duration);
        const trainer = trainers.find(t => t.id === data.trainerId);

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
                const sessionData: Omit<PTSession, 'id'> = {
                    client_id: client.id,
                    purchase_id: pkg.id,
                    trainer_id: data.trainerId,
                    session_datetime: sessionDateTime.toISOString(),
                    duration_hours: sessionDuration,
                    session_status: 'completed',
                    completed_by: trainer.name,
                    completion_timestamp: sessionDateTime.toISOString(),
                    clientSignature: data.clientSignature,
                    trainerSignature: data.trainerSignature
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
                const commissionsSnapshot = await getDocs(query(collection(db, "pt_commissions"), where("trainer_id", "==", data.trainerId), where("month_reference", "==", monthRef)));
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
                    trainer_id: data.trainerId,
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
                reset();
                setOpen(false);
            } catch (error) {
                console.error("Error completing session:", error);
                toast({ title: "Error", description: "Failed to complete the session.", variant: "destructive" });
            }
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Start New Session: {client.name}</DialogTitle>
                    <DialogDescription>Package: {pkg.package_name} ({pkg.hours_used || 0}/{pkg.hours_purchased} hours used)</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(processSubmit)}>
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="session-trainer">Trainer</Label>
                                <Controller
                                    name="trainerId"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger id="session-trainer"><SelectValue placeholder="Select Trainer"/></SelectTrigger>
                                            <SelectContent>
                                                {trainers.filter(t => t.status === 'active').map(t=> <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.trainerId && <p className="text-xs text-destructive mt-1">{errors.trainerId.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="session-duration">Duration</Label>
                                <Controller
                                    name="duration"
                                    control={control}
                                    defaultValue="1"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger id="session-duration"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 hour</SelectItem>
                                                <SelectItem value="1.5">1.5 hours</SelectItem>
                                                <SelectItem value="2">2 hours</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Controller
                                    name="clientSignature"
                                    control={control}
                                    render={({ field }) => (
                                        <SignaturePad label="Client Signature" onSignatureChange={field.onChange} />
                                    )}
                                />
                                {errors.clientSignature && <p className="text-xs text-destructive mt-1">{errors.clientSignature.message}</p>}
                            </div>
                            <div>
                                <Controller
                                    name="trainerSignature"
                                    control={control}
                                    render={({ field }) => (
                                        <SignaturePad label="Trainer Signature" onSignatureChange={field.onChange} />
                                    )}
                                />
                                {errors.trainerSignature && <p className="text-xs text-destructive mt-1">{errors.trainerSignature.message}</p>}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4 pt-4 border-t">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4"/>}
                            Confirm & Complete Session
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
