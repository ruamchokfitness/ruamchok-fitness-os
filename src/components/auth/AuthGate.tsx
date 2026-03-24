'use client';

import { useUser, useFirestore } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { collection, query, getDocs, doc, setDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Checks if an admin user exists. If not, promotes the current user to admin.
 * This is a one-time bootstrap process to solve the chicken-and-egg problem
 * of not being able to create the first admin.
 * This new version fetches all users and checks the role client-side to avoid
 * needing a Firestore index on the 'role' field, which could fail on first run.
 * @param firestore The Firestore instance.
 * @param user The currently authenticated Firebase user.
 */
async function bootstrapAdmin(firestore: Firestore, user: FirebaseUser) {
  if (!firestore || !user) return;

  const usersRef = collection(firestore, 'users');
  
  try {
    const usersSnapshot = await getDocs(usersRef);
    
    // Check if any user already has the admin role by iterating client-side
    let adminExists = false;
    usersSnapshot.forEach((doc) => {
      if (doc.data().role === 'admin') {
        adminExists = true;
      }
    });

    // If no admin user is found in the entire collection...
    if (!adminExists) {
      console.log('No admin user found. Promoting current user to admin.');
      const userDocRef = doc(firestore, 'users', user.uid);
      
      // The user document should already exist from signup. We just update the role.
      // `merge: true` is still good practice to avoid overwriting other fields accidentally.
      await setDoc(userDocRef, {
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
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    if (!isUserLoading && !user && pathname !== '/login') {
      router.push('/login');
    }

    // Once the user and firestore are available, run the admin check.
    if (!isUserLoading && user && firestore) {
      bootstrapAdmin(firestore, user).finally(() => {
        setIsBootstrapping(false);
      });
    } else if (!isUserLoading) {
        // If not logged in, or no firestore, no bootstrap needed.
        setIsBootstrapping(false);
    }
    
  }, [user, isUserLoading, router, pathname, firestore]);

  // Show loader while user is loading OR bootstrapping is in progress.
  if (isUserLoading || isBootstrapping) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    // This case handles the brief moment after loading but before the redirect effect has run.
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return <>{children}</>;
}
