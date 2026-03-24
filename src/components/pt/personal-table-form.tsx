'use client';

import React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useFirebase } from '@/firebase';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { PTSession, PersonalTableEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Save } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';

interface PersonalTableFormProps {
  session?: PTSession | null;
  existingTable?: PersonalTableEntry | null;
  clientId: string;
  packageId: string;
  onSave: () => void;
  onCancel: () => void;
}

// Make all fields optional for flexibility
const exerciseSchema = z.object({
    name: z.string().optional(),
    sets: z.string().optional(),
    reps: z.string().optional(),
    weight: z.string().optional(),
    rest: z.string().optional(),
});

const formSchema = z.object({
    focus: z.string().optional(),
    exercises: z.array(exerciseSchema).optional(),
    trainerNotes: z.string().optional(),
    clientFeedback: z.string().optional(),
});

export function PersonalTableForm({ session, existingTable, clientId, packageId, onSave, onCancel }: PersonalTableFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            focus: existingTable?.focus || '',
            exercises: existingTable?.exercises?.length ? existingTable.exercises : [{ name: '', sets: '', reps: '', weight: '', rest: '' }],
            trainerNotes: existingTable?.trainerNotes || '',
            clientFeedback: existingTable?.clientFeedback || '',
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "exercises"
    });

    const processSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!firestore) return;

        // Filter out any exercise rows where the name is empty
        const nonEmptyExercises = data.exercises?.filter(ex => ex.name && ex.name.trim() !== '') || [];

        let sessionId = session?.id;
        
        try {
            // If there's no session object, it means this is a placeholder slot.
            // We need to create a session document first.
            if (!sessionId) {
                const newSessionData = {
                    client_id: clientId,
                    purchase_id: packageId,
                    session_datetime: new Date().toISOString(), // Placeholder date, can be edited later
                    duration_hours: 0, // Placeholder, this session hasn't been "used" yet
                    session_status: 'scheduled',
                    trainer_id: '',
                };
                const newSessionRef = await addDoc(collection(firestore, 'pt_sessions'), newSessionData);
                sessionId = newSessionRef.id;
            }

            if (!sessionId) {
                throw new Error("Could not create or find session ID.");
            }

            const tableRef = doc(firestore, `pt_sessions/${sessionId}/personalTable`, sessionId);
            
            const tableData = {
                sessionId: sessionId,
                focus: data.focus,
                exercises: nonEmptyExercises,
                trainerNotes: data.trainerNotes,
                clientFeedback: data.clientFeedback,
            };

            await setDoc(tableRef, tableData, { merge: true });
            toast({ title: "Workout Saved!" });
            onSave();
        } catch (error) {
            console.error("Error saving personal table: ", error);
            toast({ title: "Error", description: "Could not save workout details.", variant: "destructive" });
        }
    };
    
    return (
        <form onSubmit={handleSubmit(processSubmit)} className="space-y-6">
            <div className="flex justify-between items-center">
                 <h4 className="font-semibold">{existingTable || session ? 'Edit Workout' : 'Add Workout Details'}</h4>
                 {(existingTable || session) && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
            </div>
            
            <div>
                <Label htmlFor="focus">Workout Focus</Label>
                <Input id="focus" {...register('focus')} placeholder="e.g., Upper Body Strength" />
            </div>

            <div className="space-y-4">
                <Label>Exercises</Label>
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-5 gap-2 items-end p-2 border rounded-md relative">
                        <Input placeholder="Exercise Name" {...register(`exercises.${index}.name`)} className="col-span-5 md:col-span-1" />
                        <Input placeholder="Sets" {...register(`exercises.${index}.sets`)} className="col-span-2 md:col-span-1" />
                        <Input placeholder="Reps" {...register(`exercises.${index}.reps`)} className="col-span-2 md:col-span-1" />
                        <Input placeholder="Weight" {...register(`exercises.${index}.weight`)} className="col-span-2 md:col-span-1" />
                        <Input placeholder="Rest" {...register(`exercises.${index}.rest`)} className="col-span-2 md:col-span-1" />
                        {fields.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-destructive" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', sets: '', reps: '', weight: '', rest: '' })}>
                    <Plus className="mr-2 h-4 w-4"/> Add Exercise
                </Button>
            </div>
            
             <div>
                <Label htmlFor="trainerNotes">Trainer Notes</Label>
                <Textarea id="trainerNotes" {...register('trainerNotes')} placeholder="Notes on client's performance, form, etc."/>
            </div>
            <div>
                <Label htmlFor="clientFeedback">Client Feedback</Label>
                <Textarea id="clientFeedback" {...register('clientFeedback')} placeholder="Any feedback from the client."/>
            </div>

             <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}
                Save Workout
            </Button>
        </form>
    );
}
