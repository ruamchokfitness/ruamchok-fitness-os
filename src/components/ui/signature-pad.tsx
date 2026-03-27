'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  onSignatureChange: (signature: string) => void;
  className?: string;
  label: string;
  initialSignature?: string;
}

export function SignaturePad({ onSignatureChange, className, label, initialSignature }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(!!initialSignature);
  
  const getCanvasCtx = () => canvasRef.current?.getContext('2d');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      if (canvas.width !== canvas.offsetWidth * ratio) canvas.width = canvas.offsetWidth * ratio;
      if (canvas.height !== canvas.offsetHeight * ratio) canvas.height = canvas.offsetHeight * ratio;

      const ctx = getCanvasCtx();
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (initialSignature) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width / ratio, canvas.height / ratio);
            };
            img.src = initialSignature;
            setHasSigned(true);
        } else {
            setHasSigned(false);
        }
      }
    }
  }, [initialSignature]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = getCanvasCtx();
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      setHasSigned(true);
    }
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = getCanvasCtx();
    if (ctx) {
      ctx.closePath();
      setIsDrawing(false);
      onSignatureChange(canvasRef.current?.toDataURL('image/png') || '');
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    const ctx = getCanvasCtx();
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = getCanvasCtx();
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onSignatureChange('');
        setHasSigned(false);
      }
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
        <label className="text-sm font-medium">{label}</label>
      <div className="relative border rounded-md bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="w-full h-32 md:h-40 cursor-crosshair touch-none"
        />
        {!hasSigned && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground">
                <p>Sign here</p>
            </div>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clearSignature} className="self-end">
        Clear
      </Button>
    </div>
  );
}
