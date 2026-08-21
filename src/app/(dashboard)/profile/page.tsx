'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { dbService } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserCircle, ShieldCheck, UserCheck, Phone, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, role, setUser } = useAuthStore();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const updated = await dbService.updateProfile(user.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      setUser(updated);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error('Failed to update profile', { description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal cashier account information and credentials.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <CardTitle className="text-lg">{user?.full_name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={role === 'owner' ? 'default' : 'secondary'} className="capitalize">
                  {role === 'owner' ? <ShieldCheck className="h-3 w-3 mr-1" /> : <UserCheck className="h-3 w-3 mr-1" />}
                  {role} Account
                </Badge>
                <span className="text-xs text-muted-foreground">Active Session</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">Full Name</label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">Phone Contact</label>
              <Input
                type="text"
                placeholder="0917-000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button type="submit" variant="emerald" disabled={isSaving} className="gap-2">
                <Check className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sign Out Card */}
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Sign Out of Terminal</h3>
            <p className="text-xs text-muted-foreground">
              End your active session on this device.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              const { useAuthStore } = await import('@/stores/authStore');
              await useAuthStore.getState().logout();
              window.location.href = '/login';
            }}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
