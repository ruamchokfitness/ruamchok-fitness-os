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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


export default function LoginPage() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth || !firestore) return;

    startTransition(async () => {
      try {
        if (authMode === 'signin') {
          const loginIdentifier = emailOrUsername.trim();
          const enteredPassword = password.trim();

          if (!loginIdentifier || !enteredPassword) {
            setError("Username/Email and Password are required.");
            return;
          }

          let emailToSignIn: string;
          // Special handling for the 'admin' username
          if (loginIdentifier.toLowerCase() === 'admin') {
            emailToSignIn = 'ruamchokfitness@gmail.com';
          } else if (!loginIdentifier.includes('@')) {
            emailToSignIn = `${loginIdentifier}@rcf.system`;
          } else {
            emailToSignIn = loginIdentifier;
          }

          await signInWithEmailAndPassword(auth, emailToSignIn, enteredPassword);
          router.push('/');
        } else { // signup mode
          if (name.trim() === '') {
            setError('Full Name is required.');
            return;
          }
          
          const emailToCreate = 'ruamchokfitness@gmail.com';
          const passwordToCreate = 'rcf0882527094';
          
          const userCredential = await createUserWithEmailAndPassword(auth, emailToCreate, passwordToCreate);
          const newUser = userCredential.user;

          // Create the user profile document in Firestore with the admin role
          await setDoc(doc(firestore, 'users', newUser.uid), {
            uid: newUser.uid,
            email: emailToCreate,
            name: name.trim(),
            role: 'admin' // Assign 'admin' role directly
          });
          
          // After successful creation, sign them in
          await signInWithEmailAndPassword(auth, emailToCreate, passwordToCreate);
          router.push('/');
        }
      } catch (err: any) {
        let errorMessage = "An unexpected error occurred.";
        switch (err.code) {
          case 'auth/invalid-email':
            errorMessage = "Invalid email or username format.";
            break;
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = "Invalid username/email or password.";
            break;
          case 'auth/email-already-in-use':
            errorMessage = "This admin account already exists. Please try signing in instead.";
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
    if (!auth) return;
    if (!resetIdentifier.trim()) {
      toast({ title: "Username or Email is required", variant: "destructive" });
      return;
    }
  
    const loginIdentifier = resetIdentifier.trim();
    let fullEmail: string;
  
    if (loginIdentifier.toLowerCase() === 'admin') {
      fullEmail = 'ruamchokfitness@gmail.com';
    } else if (loginIdentifier.includes('@')) {
      fullEmail = loginIdentifier;
    } else {
      fullEmail = `${loginIdentifier}@rcf.system`;
    }
  
    startTransition(async () => {
      try {
        await sendPasswordResetEmail(auth, fullEmail);
        toast({
          title: "Password Reset Email Sent",
          description: `If an account exists for "${loginIdentifier}", a password reset link has been sent to its associated email address.`,
        });
      } catch (error) {
        console.error("Forgot password error:", error);
        // Silently fail to prevent user enumeration
        toast({
          title: "Password Reset Email Sent",
          description: `If an account for "${loginIdentifier}" exists, a password reset link has been sent.`,
        });
      } finally {
        setResetDialogOpen(false);
        setResetIdentifier('');
      }
    });
  };

  const toggleMode = () => {
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setName('');
    setEmailOrUsername('');
    setPassword('');
  }

  return (
    <>
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <Card className="w-full max-w-sm mx-auto shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto bg-slate-900 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-white">RCF</span>
          </div>
          <CardTitle className="text-2xl">{authMode === 'signin' ? 'Sign In' : 'Create Admin Account'}</CardTitle>
          <CardDescription>Welcome to Ruamchok Fitness OS</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'signup' ? (
              <>
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
                <div className="space-y-2">
                  <Label htmlFor="emailOrUsername">Username</Label>
                  <Input
                    id="emailOrUsername"
                    type="text"
                    value="admin"
                    readOnly
                    className="bg-slate-100"
                  />
                   <p className="text-xs text-muted-foreground">Default admin username. Email will be set to `ruamchokfitness@gmail.com`.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value="rcf0882527094"
                    readOnly
                    className="bg-slate-100"
                  />
                  <p className="text-xs text-muted-foreground">The system will use this default password.</p>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
            
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {authMode === 'signin' ? 'Sign In' : 'Create Admin Account'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {authMode === 'signin' ? (
              <>
                First time setup?{" "}
                <button onClick={toggleMode} className="underline">
                  Create admin account
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
              <button onClick={() => setResetDialogOpen(true)} className="underline">
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
    <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Reset Password</AlertDialogTitle>
                <AlertDialogDescription>
                    Enter your username or email address and we will send you a link to reset your password.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
                <Label htmlFor="reset-identifier" className="sr-only">Username or Email</Label>
                <Input 
                    id="reset-identifier"
                    value={resetIdentifier} 
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    placeholder="e.g., admin or user@example.com"
                    autoFocus
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleForgotPassword} disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Send Reset Link
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
