'use client';

import React from 'react';

/**
 * Auth guard is disabled. This component will render its children directly.
 */
export function ModuleAuthGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
