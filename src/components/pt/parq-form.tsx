'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, doc, addDoc, setDoc, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCollection, useDoc } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import type { PTClient, PARQ, PhysicalAssessment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/ui/signature-pad';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

interface ParqFormProps {
  client: PTClient;
}

const medicalQuestions = [
  { id: 'heatCondition', label: 'สภาพหัวใจ' },
  { id: 'diabetes', label: 'โรคเบาหวาน' },
  { id: 'smoker', label: 'สูบบุหรี่' },
  { id: 'angina', label: 'อาการปวดรุนแรงที่หัวใจ' },
  { id: 'backProblems', label: 'ปัญหาเกี่ยวกับหลัง' },
  { id: 'pregnancy', label: 'การตั้งครรภ์' },
  { id: 'highBloodPressure', label: 'ความดันโลหิตสูง' },
  { id: 'sciatica', label: 'ปวดรุนแรงที่เส้นประสาท' },
  { id: 'hernia', label: 'ไส้เลื่อน' },
  { id: 'asthma', label: 'โรคหอบหืด' },
  { id: 'jointProblems', label: 'ปัญหาที่ข้อกระดูก' },
  { id: 'recentSurgery', label: 'การผ่าตัดเมื่อเร็วๆนี้' },
];

const fitnessGoals = [
    { id: 'fatLoss', label: 'ลดไขมัน' },
    { id: 'building', label: 'สร้างกล้ามเนื้อ' },
    { id: 'toning', label: 'กระชับกล้ามเนื้อ' }
]

const assessmentFields = [
    { id: 'height', label: 'สูง/Height (cm)', type: 'number' },
    { id: 'bodyMass', label: 'น้ำหนัก/Body Mass (Kg)', type: 'number' },
    { id: 'bloodPressure', label: 'ความดันโลหิต/Blood Pressure (mmHg)', type: 'text' },
    { id: 'restingHR', label: 'อัตราการเต้นของหัวใจขณะพัก/Resting H.R. (bpm)', type: 'number' },
    { id: 'bodyFat', label: '%ไขมัน/%Body Fat', type: 'number' },
    { id: 'shoulders', label: 'ไหล่/Shoulders (cm)', type: 'number' },
    { id: 'chest', label: 'หน้าอก/Chest (cm)', type: 'number' },
    { id: 'arms', label: 'แขน(ซ้าย/ขวา)/Arms (L/R) (cm)', type: 'text' },
    { id: 'waist', label: 'เอว/Waist (cm)', type: 'number' },
    { id: 'hips', label: 'สะโพก/Hips (cm)', type: 'number' },
    { id: 'thighs', label: 'ต้นขา(ซ้าย/ขวา)/Thighs (L/R) (cm)', type: 'text' },
    { id: 'calves', label: 'น่อง(ซ้าย/ขวา)/Calves (L/R) (cm)', type: 'text' },
    { id: 'fitTestScore', label: 'คะแนนทดสอบความฟิต/Fit test Score', type: 'number' },
    { id: 'treadmillLevel', label: 'ระดับลู่วิ่ง/Treadmill Level', type: 'number' },
    { id: 'sitReachScore', label: 'ระดับความยืดหยุ่น/Sit Reach Score (in)', type: 'number' },
    { id: 'bmi', label: 'ดรรชนีมวลร่างกาย(BMI)', type: 'number' },
];

export function ParqForm({ client }: ParqFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [parqData, setParqData] = useState<PARQ | null>(null);
    const [assessments, setAssessments] = useState<PhysicalAssessment[]>([]);
    
    // Fetch existing data
    useEffect(() => {
        const fetchData = async () => {
            if (!firestore || !client) return;
            setIsLoading(true);

            // Fetch PAR-Q (assuming one per client for simplicity)
            const parqQuery = query(collection(firestore, "pt_clients", client.id, "parqs"), where("clientId", "==", client.id));
            const parqSnapshot = await getDocs(parqQuery);
            if (!parqSnapshot.empty) {
                const data = parqSnapshot.docs[0].data() as PARQ;
                setParqData({ ...data, id: parqSnapshot.docs[0].id });
            }

            // Fetch Assessments
            const assessQuery = query(collection(firestore, "pt_clients", client.id, "physicalAssessments"), where("clientId", "==", client.id));
            const assessSnapshot = await getDocs(assessQuery);
            const assessData = assessSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PhysicalAssessment));
            setAssessments(assessData);

            setIsLoading(false);
        };
        fetchData();
    }, [client, firestore]);

    const handleSave = async (data: any) => {
        if (!firestore) return;
        
        try {
            if (parqData) { // Update existing
                await updateDoc(doc(firestore, "pt_clients", client.id, "parqs", parqData.id), data.parq);
            } else { // Create new
                await addDoc(collection(firestore, "pt_clients", client.id, "parqs"), {
                    ...data.parq, 
                    clientId: client.id,
                    createdAt: serverTimestamp()
                });
            }

            for (const assessment of Object.values(data.assessments)) {
                 if (assessment && typeof assessment === 'object' && 'id' in assessment && (assessment as any).id) {
                    await updateDoc(doc(firestore, "pt_clients", client.id, "physicalAssessments", (assessment as any).id), assessment);
                 } else if (assessment && typeof assessment === 'object' && 'assessmentType' in assessment && Object.values(assessment).some(v => v !== '' && v !== undefined && v !== null && v !== (assessment as any).assessmentType)) {
                    await addDoc(collection(firestore, "pt_clients", client.id, "physicalAssessments"), {
                        ...(assessment as object),
                        clientId: client.id,
                        createdAt: serverTimestamp()
                    });
                 }
            }
            toast({ title: 'Success', description: 'PAR-Q and Assessments saved.' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not save data.', variant: 'destructive' });
        }
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
    }

    return <FullForm client={client} existingParq={parqData} existingAssessments={assessments} onSave={handleSave} />;
}

function FullForm({ client, existingParq, existingAssessments, onSave }: { client: PTClient, existingParq: PARQ | null, existingAssessments: PhysicalAssessment[], onSave: (data:any) => void }) {
    const { register, handleSubmit, control, watch, formState: { isSubmitting } } = useForm({
        defaultValues: {
            parq: {
                ...existingParq,
                dob: existingParq?.dob || '',
                emergencyTel: existingParq?.emergencyTel || '',
                trainerToComplete: existingParq?.trainerToComplete || '',
                otherMedicalCondition: existingParq?.otherMedicalCondition || '',
                otherFitnessGoals: existingParq?.otherFitnessGoals || '',
                clientSignature: existingParq?.clientSignature || '',
                fitnessGoals: existingParq?.fitnessGoals || [],
                medicalProfile: existingParq?.medicalProfile || {},
                medicalReleaseRequired: existingParq?.medicalReleaseRequired || false,
            },
            assessments: {
                Start: existingAssessments.find(a => a.assessmentType === 'Start') || { assessmentType: 'Start' },
                Goal: existingParq?.assessmentGoals || {},
                '2 Week Reassessment': existingAssessments.find(a => a.assessmentType === '2 Week Reassessment') || { assessmentType: '2 Week Reassessment' },
                '6 Week Reassessment': existingAssessments.find(a => a.assessmentType === '6 Week Reassessment') || { assessmentType: '6 Week Reassessment' },
            }
        }
    });

    return (
        <form onSubmit={handleSubmit(onSave)}>
            <Card>
                <CardHeader>
                    <CardTitle>Physical Activity Readiness Questionnaire (PAR-Q)</CardTitle>
                    <CardDescription>กรอกข้อมูลสุขภาพและเป้าหมายของ {client.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <InputGroup label="ชื่อ/First Name" value={client.name} readOnly />
                        <InputGroup label="นามสกุล/Surname" value="" readOnly />
                        <InputGroup label="วัน/เดือน/ปีเกิด D.O.B." type="date" {...register('parq.dob')} />
                        <InputGroup label="เบอร์โทรศัพท์ติดต่อ/Phone No." value={client.phone || ''} readOnly />
                        <InputGroup label="เบอร์โทรฉุกเฉิน/Emergency Tel." {...register('parq.emergencyTel')} />
                        <InputGroup label="ผู้ฝึกสอน/Trainer" {...register('parq.trainerToComplete')} />
                    </div>
                    
                    <Separator />
                    
                    {/* Medical Profile */}
                    <div>
                        <h3 className="font-semibold text-lg mb-2">ประวัติสุขภาพร่างกาย MEDICAL PROFILE</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                            {medicalQuestions.map(q => (
                                <Controller key={q.id} name={`parq.medicalProfile.${q.id}`} control={control} render={({ field }) => (
                                     <YesNoQuestion label={q.label} value={field.value} onChange={field.onChange} />
                                )}/>
                            ))}
                        </div>
                        <Textarea placeholder="สภาพร่างกายหรือประวัติการรักษาพยาบาลอื่นโปรดระบุ/Any other medical condition, please specify:" className="mt-4" {...register('parq.otherMedicalCondition')}/>
                    </div>

                    <Separator />

                    {/* Fitness Profile */}
                    <div>
                        <h3 className="font-semibold text-lg mb-2">ข้อมูลออกกำลังกาย / FITNESS PROFILE</h3>
                        <div className="space-y-2">
                             <Label>เป้าหมายการออกกำลังกาย/Fitness Goals</Label>
                             <div className="flex gap-4">
                                {fitnessGoals.map(goal => (
                                    <Controller key={goal.id} name="parq.fitnessGoals" control={control} render={({ field }) => (
                                        <div className="flex items-center gap-2">
                                            <Checkbox 
                                                id={goal.id} 
                                                checked={field.value?.includes(goal.id)}
                                                onCheckedChange={(checked) => {
                                                    const current = field.value || [];
                                                    return checked
                                                        ? field.onChange([...current, goal.id])
                                                        : field.onChange(current.filter((value:string) => value !== goal.id))
                                                }}
                                            />
                                            <Label htmlFor={goal.id}>{goal.label}</Label>
                                        </div>
                                    )}/>
                                ))}
                             </div>
                             <Input placeholder="อื่น ๆ/Other โปรดระบุส่วนที่ต้องการเน้นพิเศษ/Specific Focus areas:" {...register('parq.otherFitnessGoals')}/>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Physical Assessment */}
                    <div>
                         <h3 className="font-semibold text-lg mb-2">การประเมินสภาพร่างกาย / PHYSICAL ASSESSMENT</h3>
                         <Tabs defaultValue="Start">
                            <TabsList>
                                <TabsTrigger value="Start">ประเมินผลครั้งที่ 1</TabsTrigger>
                                <TabsTrigger value="Goal">เป้าหมาย/Goal</TabsTrigger>
                                <TabsTrigger value="2 Week Reassessment">ประเมินผลครั้งที่ 2</TabsTrigger>
                                <TabsTrigger value="6 Week Reassessment">ประเมินผลครั้งที่ 3</TabsTrigger>
                            </TabsList>
                            <TabsContent value="Start" className="mt-4"><AssessmentForm type="Start" register={register} /></TabsContent>
                            <TabsContent value="Goal" className="mt-4"><GoalForm register={register} /></TabsContent>
                            <TabsContent value="2 Week Reassessment" className="mt-4"><AssessmentForm type="2 Week Reassessment" register={register} /></TabsContent>
                            <TabsContent value="6 Week Reassessment" className="mt-4"><AssessmentForm type="6 Week Reassessment" register={register} /></TabsContent>
                         </Tabs>
                    </div>

                    <Separator />

                    {/* Signature */}
                     <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            <div>
                                <Controller name="parq.medicalReleaseRequired" control={control} render={({ field }) => (
                                     <YesNoQuestion label="ต้องแสดงใบรับรองแพทย์ก่อนเข้าโปรแกรมออกกำลังกาย (ครูผู้ฝึกเป็นผู้วินิจฉัย)" value={field.value} onChange={field.onChange} />
                                )}/>
                                <p className="text-xs text-muted-foreground mt-1">Medical release required before participation in exercise? (Trainer to complete)</p>
                            </div>
                            <div>
                                <Controller name="parq.clientSignature" control={control} render={({ field }) => (
                                    <SignaturePad label="ลงชื่อ/Signed" onSignatureChange={field.onChange} className="mt-4" />
                                )}/>
                                <p className="text-xs text-muted-foreground mt-1">ข้าพเจ้าขอรับรองว่าข้อมูลเป็นความจริงและถูกต้อง / I certify that the information I have provided is true and correct.</p>
                            </div>
                        </div>
                    </div>
                    
                     <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                        Save PAR-Q Form
                     </Button>
                </CardContent>
            </Card>
        </form>
    )
}


const InputGroup = React.forwardRef<HTMLInputElement, { label: string } & React.InputHTMLAttributes<HTMLInputElement>>(({ label, ...props }, ref) => (
    <div>
        <Label className="text-xs">{label}</Label>
        <Input ref={ref} className="h-9" {...props} />
    </div>
));
InputGroup.displayName = "InputGroup";


const YesNoQuestion = ({ label, value, onChange }: { label: string, value: boolean | undefined, onChange: (value: boolean) => void }) => {
    return (
        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-md border">
            <span className="text-sm flex-1">{label}</span>
            <RadioGroup onValueChange={(val) => onChange(val === 'yes')} value={value === true ? 'yes' : value === false ? 'no' : ''} className="flex gap-4">
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id={`${label}-yes`} />
                    <Label htmlFor={`${label}-yes`} className="text-sm">มี/Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id={`${label}-no`} />
                    <Label htmlFor={`${label}-no`} className="text-sm">ไม่มี/No</Label>
                </div>
            </RadioGroup>
        </div>
    );
};

const AssessmentForm = ({ type, register }: { type: 'Start' | '2 Week Reassessment' | '6 Week Reassessment', register: any }) => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <InputGroup label="วันที่/date" type="date" {...register(`assessments.${type}.assessmentDate`)} />
            <InputGroup label="ผู้ฝึก/Trainer" {...register(`assessments.${type}.trainerName`)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {assessmentFields.map(field => (
                <InputGroup key={field.id} label={field.label} type={field.type} {...register(`assessments.${type}.${field.id}`)} />
            ))}
        </div>
    </div>
);

const GoalForm = ({ register }: { register: any }) => (
     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {assessmentFields.filter(f => !['height', 'fitTestScore', 'treadmillLevel', 'sitReachScore', 'bmi'].includes(f.id)).map(field => (
            <InputGroup key={field.id} label={field.label} type={field.type} {...register(`parq.assessmentGoals.${field.id}`)} />
        ))}
    </div>
);
    