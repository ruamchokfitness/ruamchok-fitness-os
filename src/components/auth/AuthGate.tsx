'use client';

import React from 'react';

/**
 * AuthGate is currently disabled to allow public access during development.
 * It will render its children directly without checking for authentication.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
