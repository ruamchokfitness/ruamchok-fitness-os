"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase/provider";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc } from "firebase/firestore";

interface EditableTextItemProps {
  itemKey: string;
  initialValue: string;
  label: string;
  action: (key: string, value: string, collectionName: string) => Promise<void>;
  collectionName: string;
  className?: string;
  inputClassName?: string;
  isTable?: boolean;
  children?: React.ReactNode;
}

export function EditableTextItem({
  itemKey,
  initialValue,
  label,
  action,
  collectionName,
  className,
  inputClassName,
  isTable = false,
  children
}: EditableTextItemProps) {
  const { firestore } = useFirebase();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSave = () => {
    if (value.trim() === initialValue || !firestore) {
      setIsEditing(false);
      return;
    }
    startTransition(async () => {
        const docRef = doc(firestore, collectionName, itemKey);
        const updateData = collectionName === 'policies' ? { key: itemKey, value: value } : { date: value };
        
        setDocumentNonBlocking(docRef, updateData, { merge: true });

        toast({
            title: "อัปเดตสำเร็จ",
            className: "bg-accent text-accent-foreground",
        });
        setIsEditing(false);
    });
  };
  
  if (isTable) {
    return isEditing ? (
        <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
            className="h-8"
        />
    ) : (
        <span onClick={() => setIsEditing(true)} className="cursor-pointer">{initialValue}</span>
    )
  }

  return (
    <div className={`flex items-center justify-between bg-gray-50 p-3 rounded-md ${className}`}>
        <div className="flex-1 flex items-center">
            {children}
            {isEditing ? (
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    autoFocus
                    className={`flex-1 ${inputClassName}`}
                    disabled={isPending}
                />
            ) : (
                <p className="font-medium flex-1">{initialValue}</p>
            )}
        </div>

      <Button
        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
        size="sm"
        variant="ghost"
        className="ml-3 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
        disabled={isPending}
      >
        {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
            <>
                <Edit className="w-3 h-3 mr-1" />
                {isEditing ? 'บันทึก' : 'แก้ไข'}
            </>
        )}
      </Button>
    </div>
  );
}
