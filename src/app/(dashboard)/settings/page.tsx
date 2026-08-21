'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { Business } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Store, Printer, CheckCircle2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => dbService.getBusiness(),
  });

  // Simple local store form states
  const [name, setName] = useState('SOX POS Store');
  const [phone, setPhone] = useState('0917-555-7890');
  const [address, setAddress] = useState('General Santos City');
  const [headerNote, setHeaderNote] = useState('Salamat sa pagpalit!');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setName(business.name || 'SOX POS Store');
      setPhone(business.phone || '');
      setAddress(business.address || '');
      setHeaderNote(business.receipt_header || 'Salamat sa pagpalit!');
    }
  }, [business]);

  const handleSaveStoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Store name is required');
      return;
    }

    setIsSaving(true);
    try {
      await dbService.updateBusiness({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        receipt_header: headerNote.trim() || null,
      });

      toast.success('Store Settings Saved');
      queryClient.invalidateQueries({ queryKey: ['business'] });
    } catch (err: any) {
      toast.error('Failed to save settings', { description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Store Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update your store name, contact number, location, and printed receipt message.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-emerald-600" />
            Store Information & Receipt
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5">
          <form onSubmit={handleSaveStoreInfo} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Store Name *
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SOX POS Store"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Contact Phone / Mobile
                </label>
                <Input
                  type="text"
                  placeholder="0917-000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Store Location / Address
                </label>
                <Input
                  type="text"
                  placeholder="e.g. GenSan, South Cotabato"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <label className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                Receipt Greeting Message
              </label>
              <Input
                type="text"
                placeholder="e.g. Salamat sa pagpalit! Please come again."
                value={headerNote}
                onChange={(e) => setHeaderNote(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                This greeting prints at the top/bottom of customer thermal receipts.
              </p>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="emerald" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Store Profile'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
