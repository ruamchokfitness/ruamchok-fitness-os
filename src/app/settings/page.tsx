"use client";

import React, { useState, useTransition } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import type { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Settings, UserCog, UserPlus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


function UserManagementPage() {
  const { firestore, auth } = useFirebase();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
  const { data: users, isLoading } = useCollection<User>(usersQuery);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const openNewUserDialog = () => {
    setEditUser(null);
    setDialogOpen(true);
  };

  const openEditUserDialog = (user: User) => {
    setEditUser(user);
    setDialogOpen(true);
  };
  
  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firestore || !auth) return;

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as 'admin' | 'staff';
    const password = formData.get('password') as string;
    const email = `${username}@rcf.system`;
    
    startTransition(async () => {
      try {
        if (editUser) { // Editing existing user
          const userRef = doc(firestore, 'users', editUser.uid);
          await updateDoc(userRef, { name, role });
          toast({ title: "Success", description: "User updated successfully." });
        } else { // Creating new user
          if (!password) {
            toast({ title: "Error", description: "Password is required for new users.", variant: "destructive" });
            return;
          }
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;
          
          const userRef = doc(firestore, 'users', newUser.uid);
          await setDoc(userRef, {
            uid: newUser.uid,
            email: email,
            name: name,
            role: role,
          });
          toast({ title: "Success", description: "User created successfully." });
        }
        setDialogOpen(false);
      } catch (error: any) {
        console.error("Error saving user:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    });
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !firestore) return;

    startTransition(async () => {
      try {
        // This is a complex operation and requires re-authentication on the client.
        // For this admin panel, we will just delete the Firestore record.
        // The Auth user will need to be deleted from the Firebase Console manually.
        await deleteDoc(doc(firestore, "users", userToDelete.uid));
        
        toast({
          title: "User Record Deleted",
          description: `User profile for ${userToDelete.name} has been deleted. Please delete the user from the Firebase Authentication console manually.`,
        });
        setDeleteDialogOpen(false);
      } catch (error: any) {
        console.error("Error deleting user:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    });
  };

  return (
    <>
      <header className="bg-slate-900 text-white py-4 md:py-6">
        <div className="container mx-auto px-4 md:px-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
            <p className="text-slate-300 text-sm md:text-base">Manage users and system settings.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Create, edit, and manage user roles.</CardDescription>
            </div>
            <Button onClick={openNewUserDialog}><UserPlus className="mr-2" />Add New User</Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username (Email)</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users || []).map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditUserDialog(user)}><UserCog className="mr-2 h-4 w-4"/>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(user)}><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Create New User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" defaultValue={editUser?.name || ''} required />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" defaultValue={editUser?.email.split('@')[0] || ''} required disabled={!!editUser} />
              {!editUser && <p className="text-xs text-muted-foreground mt-1">Username cannot be changed later.</p>}
            </div>
            {!editUser && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required />
              </div>
            )}
            <div>
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue={editUser?.role || 'staff'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editUser ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the user's data from the database. To fully remove them, you must also delete the user from the Firebase Authentication console. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : 'Delete User Record'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default UserManagementPage;
    