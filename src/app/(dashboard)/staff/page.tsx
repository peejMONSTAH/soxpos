'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { useAuthStore } from '@/stores/authStore';
import { Profile, UserRole } from '@/types/database.types';
import { formatDate } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Phone,
  Edit2,
  Lock,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function StaffPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateUserPin = useAuthStore((state) => state.updateUserPin);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>('staff');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit PIN Modal state
  const [pinModalProfile, setPinModalProfile] = useState<Profile | null>(null);
  const [newPin, setNewPin] = useState('');
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Edit Staff Name / Details Modal state
  const [editModalProfile, setEditModalProfile] = useState<Profile | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Delete Staff Modal state
  const [deleteModalProfile, setDeleteModalProfile] = useState<Profile | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  // Fetch Profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => dbService.getProfiles(),
    staleTime: 0,
    refetchOnMount: true,
  });

  const displayProfiles = React.useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles) {
      const key = `${p.full_name?.toLowerCase().trim()}_${p.role}`;
      if (!map.has(key)) {
        map.set(key, p);
      }
    }
    return Array.from(map.values());
  }, [profiles]);

  const handleOpenEdit = (p: Profile) => {
    setEditModalProfile(p);
    setEditFullName(p.full_name);
    setEditPhone(p.phone || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalProfile || !editFullName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setIsUpdatingProfile(true);
    try {
      const updated = await dbService.updateProfile(editModalProfile.id, {
        full_name: editFullName.trim(),
        phone: editPhone.trim() || null,
      });
      if (user?.id === editModalProfile.id) {
        useAuthStore.getState().setUser(updated);
      }
      toast.success(`Updated name to ${editFullName.trim()}`);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setEditModalProfile(null);
    } catch (err: any) {
      toast.error('Failed to update details', { description: err?.message });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Staff name is required');
      return;
    }

    if (pin && (pin.length !== 4 || isNaN(Number(pin)))) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    setIsSubmitting(true);
    try {
      await dbService.createProfile({
        business_id: user?.business_id || 'b0000000-0000-0000-0000-000000000001',
        full_name: fullName.trim(),
        role: staffRole,
        phone: phone.trim() || null,
        pin_code: pin.trim() || (staffRole === 'owner' ? '1234' : '1111'),
        avatar_url: null,
        status: 'active',
      });

      toast.success(`Created account for ${fullName}`, {
        description: `4-Digit PIN assigned: ${pin.trim() || (staffRole === 'owner' ? '1234' : '1111')}`,
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setIsModalOpen(false);
      setFullName('');
      setPhone('');
      setPin('');
    } catch (err: any) {
      toast.error('Failed to create staff account', { description: err?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusToggle = async (profile: Profile) => {
    const newStatus = profile.status === 'active' ? 'inactive' : 'active';
    try {
      await dbService.updateProfile(profile.id, { status: newStatus });
      toast.success(`Updated ${profile.full_name} status to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err: any) {
      toast.error('Failed to update status', { description: err?.message });
    }
  };

  const handleOpenDelete = (profile: Profile) => {
    if (profile.id === user?.id) {
      toast.error('You cannot delete your own account while logged in');
      return;
    }
    if (profile.role === 'owner') {
      toast.error('Store Owner account cannot be deleted');
      return;
    }
    setDeleteModalProfile(profile);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalProfile) return;

    setIsDeletingStaff(true);
    try {
      await dbService.deleteProfile(deleteModalProfile.id);
      toast.success(`Permanently deleted ${deleteModalProfile.full_name} from the database`);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setDeleteModalProfile(null);
    } catch (err: any) {
      toast.error('Failed to delete staff member', { description: err?.message });
    } finally {
      setIsDeletingStaff(false);
    }
  };


  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalProfile) return;

    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      toast.error('PIN must be exactly 4 numbers (e.g. 1234)');
      return;
    }

    setIsUpdatingPin(true);
    try {
      await updateUserPin(pinModalProfile.id, newPin);
      toast.success(`Updated PIN for ${pinModalProfile.full_name} to ${newPin}`);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setPinModalProfile(null);
      setNewPin('');
    } catch (err: any) {
      toast.error('Failed to update PIN', { description: err?.message });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Staff & Cashier Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage cashier permissions, 4-digit PINs, and quick switching access.
          </p>
        </div>

        <Button
          variant="emerald"
          onClick={() => setIsModalOpen(true)}
          className="gap-2 font-semibold shadow-xs"
        >
          <UserPlus className="h-4 w-4" />
          Add Staff Member
        </Button>
      </div>

      {/* Staff Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role / Permissions</TableHead>
                <TableHead>4-Digit PIN</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayProfiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold text-foreground">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                        {p.full_name.charAt(0)}
                      </div>
                      <div>
                        <div>{p.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{p.id === user?.id ? 'Current User' : formatDate(p.created_at)}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={p.role === 'owner' ? 'default' : 'secondary'}
                      className="capitalize text-[10px] gap-1"
                    >
                      {p.role === 'owner' ? (
                        <ShieldCheck className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <UserCheck className="h-3 w-3 text-primary" />
                      )}
                      {p.role}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <button
                      onClick={() => {
                        setPinModalProfile(p);
                        setNewPin(p.pin_code || (p.role === 'owner' ? '1234' : '1111'));
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted hover:bg-muted/80 text-xs font-mono font-medium text-foreground transition-colors group"
                      title="Click to edit PIN"
                    >
                      <KeyRound className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{p.pin_code ? '•••• (Set)' : 'Set PIN'}</span>
                      <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground ml-1" />
                    </button>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {p.phone || '—'}
                  </TableCell>

                  <TableCell>
                    <Badge variant={p.status === 'active' ? 'success' : 'destructive'} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right space-x-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(p)}
                      className="text-xs h-7 gap-1"
                      title="Edit Account Details"
                    >
                      <Edit2 className="h-3 w-3 text-primary" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPinModalProfile(p);
                        setNewPin(p.pin_code || (p.role === 'owner' ? '1234' : '1111'));
                      }}
                      className="text-xs h-7 gap-1"
                    >
                      <KeyRound className="h-3 w-3 text-emerald-600" />
                      <span>Change PIN</span>
                    </Button>

                    {p.role !== 'owner' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusToggle(p)}
                          className="text-xs h-7"
                        >
                          {p.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(p)}
                          className="text-xs h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                          title={`Delete ${p.full_name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Staff Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              <span>Create Staff Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a cashier or manager profile and assign them a 4-digit PIN for instant terminal switching.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Full Name *
              </label>
              <Input
                type="text"
                placeholder="e.g. Maria Santos"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Role / Access Level
                </label>
                <Select value={staffRole} onValueChange={(v) => setStaffRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff (POS & Sales only)</SelectItem>
                    <SelectItem value="owner">Owner (Full admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Phone (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="0918-123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                4-Digit Quick Passcode / PIN *
              </label>
              <Input
                type="password"
                placeholder="e.g. 1111"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="font-mono tracking-widest text-center"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Used to quickly switch cashiers at the counter terminal.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change PIN Modal */}
      <Dialog open={!!pinModalProfile} onOpenChange={(open) => !open && setPinModalProfile(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              <span>Update PIN Code</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Change the 4-digit terminal login PIN for <strong className="text-foreground">{pinModalProfile?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePin} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block text-center">
                Enter New 4-Digit PIN
              </label>
              <Input
                type="password"
                maxLength={4}
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                className="text-center font-mono text-xl tracking-widest h-12"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPinModalProfile(null)}
                disabled={isUpdatingPin}
              >
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={isUpdatingPin}>
                {isUpdatingPin ? 'Saving...' : 'Save PIN'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT STAFF DETAILS MODAL */}
      <Dialog open={!!editModalProfile} onOpenChange={(open) => !open && setEditModalProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Edit2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Edit Account Details</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update name and contact details for <strong className="text-foreground">{editModalProfile?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Paul"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Phone Number (Optional)
              </label>
              <Input
                type="tel"
                placeholder="e.g. 0917-889-4521"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalProfile(null)}
                disabled={isUpdatingProfile}
              >
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={isUpdatingProfile}>
                {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE STAFF CONFIRMATION MODAL */}
      <Dialog open={!!deleteModalProfile} onOpenChange={(open) => !open && setDeleteModalProfile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-rose-600 dark:text-rose-400">
                  Delete Staff Account
                </DialogTitle>
                <DialogDescription className="text-xs">
                  This action is permanent and cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {deleteModalProfile && (
            <div className="space-y-4 py-2">
              {/* Staff Member Card */}
              <div className="p-3.5 bg-muted/60 rounded-xl border border-border/80 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center text-sm border border-rose-500/30">
                  {deleteModalProfile.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground truncate">
                    {deleteModalProfile.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="capitalize">{deleteModalProfile.role}</span>
                    {deleteModalProfile.phone && <span>· {deleteModalProfile.phone}</span>}
                  </div>
                </div>
                <Badge variant="destructive" className="text-[10px] uppercase">
                  {deleteModalProfile.status}
                </Badge>
              </div>

              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <p className="font-semibold">⚠️ What happens when you delete this account:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] opacity-90">
                  <li>Their login access and 4-digit PIN will be revoked immediately.</li>
                  <li>Their account record will be removed from your database.</li>
                  <li>Past completed sales and audit history created by this staff member will be preserved.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalProfile(null)}
              disabled={isDeletingStaff}
              className="w-full"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeletingStaff}
              className="w-full font-bold gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {isDeletingStaff ? 'Deleting...' : 'Delete Staff Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

