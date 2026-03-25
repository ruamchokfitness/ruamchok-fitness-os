'use client';

import { useUser, useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const pathname = usePathname();

  // Fetch the global security settings to check for forced sign-out
  const securitySettingsRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'security', 'settings') : null),
    [firestore]
  );
  const { data: securitySettings, isLoading: isSettingsLoading } = useDoc<{lastForcedSignOut: any}>(securitySettingsRef);


  useEffect(() => {
    // If user data has loaded and there's no user, redirect to login page
    if (!isUserLoading && !user && pathname !== '/login') {
      router.push('/login');
    }

    // Session invalidation logic
    if (!isUserLoading && !isSettingsLoading && user && auth) {
      const loginTimestampStr = localStorage.getItem('loginTimestamp');
      const lastForcedSignOut = securitySettings?.lastForcedSignOut;

      if (lastForcedSignOut) {
        if (loginTimestampStr) {
          const loginTimestamp = parseInt(loginTimestampStr, 10);
          if (lastForcedSignOut.toMillis() > loginTimestamp) {
            signOut(auth); // This will trigger the redirect via the first useEffect
          }
        } else {
          // This handles users from sessions before this feature was implemented.
          // If a force sign out has ever happened, log them out to get a fresh login timestamp.
          signOut(auth);
        }
      }
    }
  }, [user, isUserLoading, isSettingsLoading, securitySettings, pathname, router, auth]);

  // While user status or critical settings are loading, show a global spinner
  const isLoading = isUserLoading || (!!user && isSettingsLoading);
  if (isLoading) {
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

