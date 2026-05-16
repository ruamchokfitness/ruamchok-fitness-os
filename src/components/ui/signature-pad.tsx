'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
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

  // Initialization and Sharpness Handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    
    // Set internal resolution based on CSS size * pixel ratio
    const width = canvas.offsetWidth * ratio;
    const height = canvas.offsetHeight * ratio;
    
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Reset transform and apply scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    
    // Global drawing styles
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#111';

    // Draw initial signature if provided
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      };
      img.src = initialSignature;
      setHasSigned(true);
    }
  }, [initialSignature]);

  // Positional calculation
  const getPos = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const handleStart = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const ctx = getCanvasCtx();
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  }, [getPos]);

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = getCanvasCtx();
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getPos]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;
    const ctx = getCanvasCtx();
    if (ctx) {
      ctx.closePath();
      setIsDrawing(false);
      onSignatureChange(canvasRef.current?.toDataURL('image/png') || '');
    }
  }, [isDrawing, onSignatureChange]);

  // Attach native listeners to allow { passive: false }
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const options = { passive: false };

    // Mouse Events
    canvas.addEventListener('mousedown', handleStart as any);
    window.addEventListener('mousemove', handleMove as any);
    window.addEventListener('mouseup', handleEnd as any);

    // Touch Events
    canvas.addEventListener('touchstart', handleStart as any, options);
    canvas.addEventListener('touchmove', handleMove as any, options);
    canvas.addEventListener('touchend', handleEnd as any, options);

    return () => {
      canvas.removeEventListener('mousedown', handleStart as any);
      window.removeEventListener('mousemove', handleMove as any);
      window.removeEventListener('mouseup', handleEnd as any);
      canvas.removeEventListener('touchstart', handleStart as any);
      canvas.removeEventListener('touchmove', handleMove as any);
      canvas.removeEventListener('touchend', handleEnd as any);
    };
  }, [handleStart, handleMove, handleEnd]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onSignatureChange('');
        setHasSigned(false);
      }
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative border-2 border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
        <canvas
          ref={canvasRef}
          className="w-full h-32 md:h-40 cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />
        {!hasSigned && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 opacity-40 select-none">
            <p className="text-sm font-medium">เซ็นชื่อที่นี่ / Sign here</p>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={clearSignature}
          className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-destructive hover:bg-destructive/5 h-7 px-2"
        >
          ล้างลายเซ็น / Clear Signature
        </Button>
      </div>
    </div>
  );
}
