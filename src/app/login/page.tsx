"use client";

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';


export default function LoginPage() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth || !firestore) return;

    startTransition(async () => {
        const loginIdentifier = emailOrUsername.trim();
        const enteredPassword = password.trim();

        if (!loginIdentifier || !enteredPassword) {
            setError("Username/Email and Password are required.");
            return;
        }

        const isAdminLogin = loginIdentifier.toLowerCase() === 'admin' && enteredPassword === 'rcf0882527094';
        const emailToUse = isAdminLogin ? 'admin@rcf.system' : loginIdentifier;

        try {
            // First, always try to sign in.
            await signInWithEmailAndPassword(auth, emailToUse, enteredPassword);
            router.push('/');
        } catch (signInError: any) {
            // If sign-in fails specifically for the initial admin setup, try creating the account.
            if (isAdminLogin && (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential')) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, enteredPassword);
                    const newUser = userCredential.user;

                    // Create the user profile document in Firestore with the admin role
                    await setDoc(doc(firestore, 'users', newUser.uid), {
                        uid: newUser.uid,
                        email: emailToUse,
                        name: 'Admin', // Default name for the first admin
                        role: 'admin'
                    });
                    
                    // createUserWithEmailAndPassword automatically signs in the new user, so we can redirect.
                    router.push('/');

                } catch (creationError: any) {
                    // If the creation attempt *also* fails, it's a definitive problem.
                    let creationErrorMessage = "An unexpected error occurred during admin setup.";
                    if (creationError.code === 'auth/email-already-in-use') {
                        creationErrorMessage = "The admin account exists but the password you entered is incorrect. Please try again or reset the password if needed.";
                    } else {
                        creationErrorMessage = `Admin account setup failed: ${creationError.message}`;
                    }
                    setError(creationErrorMessage);
                    console.error("Admin creation error:", creationError);
                }
            } else {
                // For any other user or any other type of error, show a generic invalid credential message.
                setError("Invalid username or password. Please try again.");
                console.error("Sign-in error:", signInError);
            }
        }
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <Card className="w-full max-w-sm mx-auto shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto bg-slate-900 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-white">RCF</span>
          </div>
          <CardTitle className="text-2xl">Ruamchok Fitness OS</CardTitle>
          <CardDescription>Please sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailOrUsername">Username or Email</Label>
              <Input
                id="emailOrUsername"
                type="text"
                placeholder="Enter username or email"
                required
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-4">
              For initial setup, use the provided admin credentials. The system will create the account if it doesn't exist.
          </p>
        </CardContent>
      </Card>
      <footer className="absolute bottom-4 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Ruamchok Fitness. All rights reserved.
      </footer>
    </div>
  );
}
