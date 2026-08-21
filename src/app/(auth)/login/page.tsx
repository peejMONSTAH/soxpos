'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Store, Mail, Lock, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const initialize = useAuthStore((state) => state.initialize);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  React.useEffect(() => {
    if (!isAuthLoading && user) {
      router.replace(user.role === 'owner' ? '/dashboard' : '/pos');
    }
  }, [user, isAuthLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
      toast.success('Signed in successfully! Welcome to SOX POS.');
      router.push('/pos');
    } catch (err: any) {
      toast.error('Sign In Failed', {
        description: err?.message || 'Please check your email and password.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            SOX POS
          </h1>
          <p className="text-sm text-muted-foreground">
            Sales & Inventory Management System
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold">
              Store Sign In
            </CardTitle>
            <CardDescription className="text-xs">
              Enter your store owner credentials to connect this POS terminal.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Store Owner Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="owner@soxpos.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="emerald"
                size="lg"
                disabled={isLoading}
                className="w-full font-bold gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Quick PIN info note */}
            <div className="p-3 bg-muted/60 rounded-lg border border-border/70 flex items-start gap-2.5 text-xs text-muted-foreground">
              <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground">Cashier Switching:</span> Cashier staff use their 4-digit PIN to open shifts and ring sales directly from the top bar once signed in.
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-center border-t border-border/40 py-3 text-xs text-muted-foreground">
            <span>Powered by SOX POS & Supabase Database</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
