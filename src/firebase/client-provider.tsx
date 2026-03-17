'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider, useUser } from '@/firebase/provider';
import { initializeFirebase, initiateAnonymousSignIn } from '@/firebase';
import { Auth } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * A component that ensures a user is signed in before rendering its children.
 * If no user is signed in, it attempts an anonymous sign-in.
 * Displays a loading indicator while checking auth state or waiting for sign-in.
 */
function AuthGate({ children, auth }: { children: React.ReactNode; auth: Auth }) {
    const { user, isUserLoading } = useUser();

    useEffect(() => {
        // When auth is ready and there's no user, sign in anonymously.
        if (!isUserLoading && !user) {
            initiateAnonymousSignIn(auth);
        }
    }, [user, isUserLoading, auth]);

    // While the initial user is loading, or if there's no user yet (anonymous sign-in may be in progress),
    // show a loading screen. This prevents data fetching before authentication is complete.
    if (isUserLoading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // Once a user is available, render the children.
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
      <AuthGate auth={firebaseServices.auth}>
        {children}
      </AuthGate>
    </FirebaseProvider>
  );
}
