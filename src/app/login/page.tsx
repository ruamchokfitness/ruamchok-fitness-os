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
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and Password are required.");
      return;
    }

    const email = `${username.trim()}@rcf.system`;

    startTransition(async () => {
      try {
        if (authMode === 'signin') {
          await signInWithEmailAndPassword(auth, email, password);
          router.push('/');
        } else { // signup mode
          if (!name.trim()) {
            setError("Full Name is required.");
            return;
          }
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;

          // Create the user profile document in Firestore
          await setDoc(doc(firestore, 'users', newUser.uid), {
            uid: newUser.uid,
            email: email,
            name: name.trim(),
            role: 'staff' // Default role, AuthGate will promote if it's the first user.
          });
          
          // Successful sign-up automatically signs the user in.
          // The onAuthStateChanged listener and AuthGate will handle the redirect.
          router.push('/');
        }
      } catch (err: any) {
        let errorMessage = "An unexpected error occurred.";
        switch (err.code) {
          case 'auth/invalid-email':
            errorMessage = "Invalid username format. Avoid special characters.";
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = "Invalid username or password.";
            break;
          case 'auth/email-already-in-use':
            errorMessage = "This username is already taken. Please choose another.";
            break;
          case 'auth/weak-password':
            errorMessage = "Password should be at least 6 characters.";
            break;
          default:
            errorMessage = err.message;
        }
        setError(errorMessage);
        console.error(err);
      }
    });
  };

  const handleForgotPassword = () => {
    const promptedUsername = prompt("Please enter the username to reset the password for:");
    if (promptedUsername) {
      const fullEmail = `${promptedUsername.trim()}@rcf.system`;
      sendPasswordResetEmail(auth, fullEmail)
        .then(() => {
          toast({ title: "Password Reset Email Sent", description: `If a user with username "${promptedUsername}" exists, a password reset link has been sent to their registered email address.` });
        })
        .catch((error) => {
          toast({ title: "Error", description: "Could not send password reset email.", variant: "destructive" });
        });
    }
  };

  const toggleMode = () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setName('');
    setUsername('');
    setPassword('');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <Card className="w-full max-w-sm mx-auto shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto bg-slate-900 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-white">RCF</span>
          </div>
          <CardTitle className="text-2xl">{authMode === 'signin' ? 'Sign In' : 'Create Account'}</CardTitle>
          <CardDescription>Welcome to Ruamchok Fitness OS</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {authMode === 'signin' ? (
              <>
                Don&apos;t have an account?{" "}
                <button onClick={toggleMode} className="underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button onClick={toggleMode} className="underline">
                  Sign in
                </button>
              </>
            )}
          </div>
          {authMode === 'signin' && (
            <div className="mt-4 text-center text-sm">
              <button onClick={handleForgotPassword} className="underline">
                Forgot Password?
              </button>
            </div>
          )}
        </CardContent>
      </Card>
      <footer className="absolute bottom-4 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Ruamchok Fitness. All rights reserved.
      </footer>
    </div>
  );
}
