'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { Profile } from '@/types/database.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  UserCheck,
  KeyRound,
  Delete,
  X,
  ChevronDown,
  Lock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function UserRoleSwitcher() {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const switchUserWithPin = useAuthStore((state) => state.switchUserWithPin);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch all profiles for switching
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => dbService.getProfiles(),
  });

  const activeProfiles = React.useMemo(() => {
    const active = profiles.filter((p) => p.status === 'active');
    const seen = new Map<string, Profile>();
    for (const p of active) {
      const key = `${p.full_name?.toLowerCase().trim()}_${p.role}`;
      if (!seen.has(key)) {
        seen.set(key, p);
      }
    }
    return Array.from(seen.values());
  }, [profiles]);

  const handleSelectProfile = (p: Profile) => {
    setSelectedProfile(p);
    setPin('');
    setErrorMsg('');
  };

  const handlePinInput = useCallback((digit: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
      setErrorMsg('');
    }
  }, [pin]);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setErrorMsg('');
  }, []);

  // Submit PIN when 4 digits are reached
  useEffect(() => {
    if (pin.length === 4 && selectedProfile) {
      const verify = async () => {
        setIsVerifying(true);
        setErrorMsg('');
        const res = await switchUserWithPin(selectedProfile.id, pin);
        setIsVerifying(false);

        if (res.success) {
          toast.success(`Active user switched to ${selectedProfile.full_name}`, {
            description: selectedProfile.role === 'owner'
              ? 'Owner management privileges unlocked.'
              : 'Cashier POS mode active.',
          });
          setIsOpen(false);
          setPin('');
          setSelectedProfile(null);
        } else {
          setErrorMsg(res.message || 'Incorrect PIN code');
          setPin('');
        }
      };
      verify();
    }
  }, [pin, selectedProfile, switchUserWithPin]);

  // Physical keyboard support when modal is open
  useEffect(() => {
    if (!isOpen || !selectedProfile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        if (selectedProfile) {
          setSelectedProfile(null);
          setPin('');
        } else {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedProfile, handlePinInput, handleBackspace]);

  const handleOpenModal = () => {
    setSelectedProfile(null);
    setPin('');
    setErrorMsg('');
    setIsOpen(true);
  };

  return (
    <>
      {/* Top Navbar Switcher Trigger */}
      <button
        onClick={handleOpenModal}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all shadow-xs group',
          role === 'owner'
            ? 'bg-card border-emerald-500/40 text-foreground hover:border-emerald-500'
            : 'bg-card border-primary/40 text-foreground hover:border-primary'
        )}
        title="Switch cashier or change role"
      >
        <div
          className={cn(
            'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
            role === 'owner' ? 'bg-emerald-600' : 'bg-primary'
          )}
        >
          {user?.full_name?.charAt(0) || 'U'}
        </div>

        <div className="flex flex-col text-left leading-tight hidden sm:block">
          <span className="font-semibold text-foreground text-[11px] truncate max-w-[100px]">
            {user?.full_name?.split(' ')[0] || 'User'}
          </span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
            {role}
          </span>
        </div>

        <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-transform" />
      </button>

      {/* Switch Cashier / PIN Pad Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader className="text-center space-y-1">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mb-1">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              {selectedProfile ? `Enter PIN for ${selectedProfile.full_name}` : 'Switch Cashier / User'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedProfile
                ? 'Type your 4-digit PIN on the pad or keyboard.'
                : 'Select an account to switch terminal access.'}
            </DialogDescription>
          </DialogHeader>

          {!selectedProfile ? (
            /* Step 1: Select User Card */
            <div className="space-y-2.5 pt-2">
              {activeProfiles.map((p) => {
                const isCurrent = user?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProfile(p)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all',
                      isCurrent
                        ? 'border-primary bg-primary/5 shadow-xs'
                        : 'border-border bg-card hover:bg-muted/60 hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-white',
                          p.role === 'owner' ? 'bg-emerald-600' : 'bg-primary'
                        )}
                      >
                        {p.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          {p.full_name}
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 text-primary border-primary">
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          {p.role === 'owner' ? (
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <UserCheck className="h-3 w-3 text-primary" />
                          )}
                          <span className="capitalize">{p.role} Account</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <span>Enter PIN</span>
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Step 2: PIN Numpad Screen */
            <div className="space-y-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedProfile(null);
                  setPin('');
                  setErrorMsg('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
              >
                ← Back to User List
              </button>

              {/* PIN Bubbles Display */}
              <div className="flex flex-col items-center justify-center py-2 space-y-2">
                <div className="flex items-center gap-4">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          'h-4 w-4 rounded-full border-2 transition-all duration-150',
                          isFilled
                            ? 'bg-emerald-600 border-emerald-600 scale-110 shadow-xs'
                            : 'border-muted-foreground/40 bg-muted/20'
                        )}
                      />
                    );
                  })}
                </div>

                {errorMsg && (
                  <p className="text-xs font-semibold text-destructive animate-bounce">
                    {errorMsg}
                  </p>
                )}

                {isVerifying && (
                  <p className="text-xs text-muted-foreground">Verifying PIN...</p>
                )}
              </div>

              {/* Numpad Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    variant="outline"
                    onClick={() => handlePinInput(num)}
                    disabled={isVerifying}
                    className="h-12 text-lg font-bold hover:bg-muted active:scale-95 transition-transform"
                  >
                    {num}
                  </Button>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClear}
                  disabled={isVerifying || pin.length === 0}
                  className="h-12 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePinInput('0')}
                  disabled={isVerifying}
                  className="h-12 text-lg font-bold hover:bg-muted active:scale-95 transition-transform"
                >
                  0
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackspace}
                  disabled={isVerifying || pin.length === 0}
                  className="h-12 text-xs font-semibold text-muted-foreground hover:text-destructive active:scale-95"
                >
                  <Delete className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
