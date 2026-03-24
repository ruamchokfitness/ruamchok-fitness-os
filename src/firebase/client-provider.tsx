'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FirebaseProvider, useUser } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { Auth } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * An authentication gate that protects routes.
 * It ensures a user is signed in before rendering any children,
 * redirecting to a login page if necessary.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // This effect handles redirection logic based on authentication state.
    if (!isUserLoading) { // Only run logic once auth state is resolved.
      if (!user && pathname !== '/login') {
        // If there's no user and we're not on the login page, redirect to login.
        router.push('/login');
      } else if (user && pathname === '/login') {
        // If a user is logged in and they try to visit the login page, redirect to home.
        router.push('/');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  // While auth state is loading, show a full-screen loader.
  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If there's no user and we are not on the login page,
  // continue showing a loader while the redirection initiated by useEffect happens.
  if (!user && pathname !== '/login') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If the user is logged in and on the login page, show a loader while redirecting.
  if (user && pathname === '/login') {
     return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  // If all checks pass (e.g., user is logged in and not on /login, or no user and on /login),
  // render the intended children components.
  return <>{children}</>;
}


export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthGate>
        {children}
      </AuthGate>
    </FirebaseProvider>
  );
}
