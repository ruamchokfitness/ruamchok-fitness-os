'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If user data has loaded, is falsy (not logged in), and we are not on the login page
    if (!isUserLoading && !user && pathname !== '/login') {
      // Redirect to the login page
      router.push('/login');
    }
  }, [user, isUserLoading, router, pathname]);

  // While user status is loading, show a global spinner
  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is finished, but there's no user, and we are not on the login page,
  // show a spinner while the redirect is in flight.
  if (!user && pathname !== '/login') {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  // If user is loaded, or we are on the login page, render the children
  return <>{children}</>;
}
