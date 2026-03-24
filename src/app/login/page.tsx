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

function isValidEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

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

        const isSpecialAdminLogin = loginIdentifier.toLowerCase() === 'admin';
        let emailToUse: string;

        if (isSpecialAdminLogin) {
            emailToUse = 'admin@rcf.system';
        } else if (isValidEmail(loginIdentifier)) {
            emailToUse = loginIdentifier;
        } else {
            setError("Invalid input. Please enter 'admin' or a valid email address.");
            return;
        }

        if (isSpecialAdminLogin && enteredPassword === 'rcf0882527094') {
             try {
                await signInWithEmailAndPassword(auth, emailToUse, enteredPassword);
                router.push('/');
            } catch (signInError: any) {
                if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
                    try {
                        const userCredential = await createUserWithEmailAndPassword(auth, emailToUse, enteredPassword);
                        const newUser = userCredential.user;

                        await setDoc(doc(firestore, 'users', newUser.uid), {
                            uid: newUser.uid,
                            email: emailToUse,
                            name: 'Admin',
                            role: 'admin'
                        });
                        
                        router.push('/');

                    } catch (creationError: any) {
                        let creationErrorMessage = "An unexpected error occurred during admin setup.";
                        if (creationError.code === 'auth/email-already-in-use') {
                            creationErrorMessage = "The admin account exists, but the password you entered is incorrect.";
                        } else {
                            creationErrorMessage = `Admin account setup failed: ${creationError.message}`;
                        }
                        setError(creationErrorMessage);
                    }
                } else {
                    setError("The password you entered is incorrect. Please try again.");
                }
            }
        } else {
            try {
                await signInWithEmailAndPassword(auth, emailToUse, enteredPassword);
                router.push('/');
            } catch (error: any) {
                setError("Invalid email or password. Please try again.");
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
                placeholder="Enter 'admin' or your email"
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
              For initial setup, use username 'admin'. The system will create the account if it doesn't exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
