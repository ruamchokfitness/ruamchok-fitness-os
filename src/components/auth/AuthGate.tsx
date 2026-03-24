'use client';

import { useUser, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Checks if an admin user exists. If not, promotes the current user to admin.
 * This is a one-time bootstrap process to solve the chicken-and-egg problem
 * of not being able to create the first admin.
 * @param firestore The Firestore instance.
 * @param user The currently authenticated Firebase user.
 */
async function bootstrapAdmin(firestore: Firestore, user: FirebaseUser) {
  if (!firestore || !user) return;

  const usersRef = collection(firestore, 'users');
  // Query for any document with the role 'admin'
  const adminQuery = query(usersRef, where('role', '==', 'admin'), limit(1));

  try {
    const adminSnapshot = await getDocs(adminQuery);

    // If no admin user is found in the database...
    if (adminSnapshot.empty) {
      console.log('No admin user found. Promoting current user to admin.');
      const userDocRef = doc(firestore, 'users', user.uid);
      
      // We use setDoc with merge:true. This will create the user document if it's
      // missing, or just add/update the `role` field if the document already exists.
      // This is a safe way to ensure the first user becomes an admin.
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || 'Admin', // Use display name, email, or a fallback
        role: 'admin',
      }, { merge: true });
      
      console.log(`User ${user.uid} has been promoted to admin.`);
    }
  } catch (error) {
    console.error("Error during admin bootstrap:", error);
    // We don't block the app if this fails, but log it for debugging.
  }
}


export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading && !user && pathname !== '/login') {
      router.push('/login');
    }

    // Once the user and firestore are available, run the admin check.
    if (!isUserLoading && user && firestore) {
      bootstrapAdmin(firestore, user);
    }
    
  }, [user, isUserLoading, router, pathname, firestore]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    // Still loading or redirecting
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return <>{children}</>;
}
