'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { useAuthStore } from '@/stores/authStore';
import { useShiftStore } from '@/stores/shiftStore';
import { Shift, ShiftType, Profile } from '@/types/database.types';
import { formatPeso, formatDateTime } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CurrencyText } from '@/components/ui/currency-text';
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Clock,
  Sun,
  Moon,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  History,
  Lock,
  UserCheck,
  Users,
  Shield,
  Edit2,
  Calendar,
  Sparkles,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

export interface StaffCustomSchedule {
  shiftName: string;
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "16:00"
  workingDays: string; // e.g. "Mon - Sat"
  notes?: string;
}

// Convert "14:30" to "2:30 PM"
function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr || '00'} ${ampm}`;
}

// Calculate hours between 2 times
function calculateDurationHours(start: string, end: string): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMinutes = sh * 60 + (sm || 0);
  let endMinutes = eh * 60 + (em || 0);
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // Next day
  }
  const diffHours = (endMinutes - startMinutes) / 60;
  return diffHours.toFixed(1).replace('.0', '') + ' hrs';
}

const DEFAULT_SCHEDULE: StaffCustomSchedule = {
  shiftName: 'Regular Shift',
  startTime: '08:00',
  endTime: '17:00',
  workingDays: 'Monday – Saturday',
};

export default function ShiftPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const { activeShift, startShift, endShift } = useShiftStore();

  // Active shift cash drawer modal states
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [activeShiftNameInput, setActiveShiftNameInput] = useState('Morning Cashier');
  const [activeShiftType, setActiveShiftType] = useState<ShiftType>('morning');
  const [openingCash, setOpeningCash] = useState<string>('1000');
  const [actualCash, setActualCash] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Custom Staff Schedule Modal
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Profile | null>(null);
  const [formShiftName, setFormShiftName] = useState('Morning Shift');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formWorkingDays, setFormWorkingDays] = useState('Monday – Saturday');
  const [formNotes, setFormNotes] = useState('');

  // Fetch staff profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => dbService.getProfiles(),
  });

  const activeProfiles = useMemo(() => profiles.filter((p) => p.status === 'active'), [profiles]);

  // Fetch all shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => dbService.getShifts(),
  });

  // Filter visible shifts based on role (staff only sees their own shift history)
  const visibleShifts = useMemo(() => {
    if (role === 'staff' && user?.id) {
      return shifts.filter((s) => s.user_id === user.id);
    }
    return shifts;
  }, [shifts, role, user]);

  // Fetch sales for active shift cash calculation
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => dbService.getSales(),
  });

  // Calculate live cash sales for open shift
  const activeShiftCashSales = activeShift
    ? sales
        .filter((s) => s.shift_id === activeShift.id && s.payment_method === 'cash' && s.status === 'completed')
        .reduce((sum, s) => sum + s.total, 0)
    : 0;

  const currentExpectedCash = activeShift ? activeShift.opening_cash + activeShiftCashSales : 0;

  // Custom schedule storage per staff member
  const [customSchedules, setCustomSchedules] = useState<Record<string, StaffCustomSchedule>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('pos_custom_staff_schedules');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const getStaffSchedule = (staffId: string, role: string): StaffCustomSchedule => {
    if (customSchedules[staffId]) return customSchedules[staffId];
    if (role === 'owner') {
      return {
        shiftName: 'Manager / Flexible',
        startTime: '08:00',
        endTime: '20:00',
        workingDays: 'All Operating Days',
        notes: 'Flexible oversight',
      };
    }
    return DEFAULT_SCHEDULE;
  };

  const handleOpenEditSchedule = (staff: Profile) => {
    if (role !== 'owner') {
      toast.error('Permission Denied', {
        description: 'Only store owners/managers can modify staff schedules.',
      });
      return;
    }
    const currentSched = getStaffSchedule(staff.id, staff.role);
    setEditingStaff(staff);
    setFormShiftName(currentSched.shiftName);
    setFormStartTime(currentSched.startTime);
    setFormEndTime(currentSched.endTime);
    setFormWorkingDays(currentSched.workingDays || 'Monday – Saturday');
    setFormNotes(currentSched.notes || '');
    setIsEditScheduleOpen(true);
  };

  const handleSaveCustomSchedule = () => {
    if (role !== 'owner' || !editingStaff) {
      toast.error('Permission Denied', {
        description: 'Only store owners/managers can modify staff schedules.',
      });
      return;
    }
    const updated: Record<string, StaffCustomSchedule> = {
      ...customSchedules,
      [editingStaff.id]: {
        shiftName: formShiftName.trim() || 'Custom Shift',
        startTime: formStartTime,
        endTime: formEndTime,
        workingDays: formWorkingDays.trim() || 'Custom Days',
        notes: formNotes.trim() || undefined,
      },
    };
    setCustomSchedules(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_custom_staff_schedules', JSON.stringify(updated));
    }
    toast.success(`Custom schedule updated for ${editingStaff.full_name}`, {
      description: `${formShiftName}: ${formatTime12h(formStartTime)} – ${formatTime12h(formEndTime)} (${formWorkingDays})`,
    });
    setIsEditScheduleOpen(false);
  };

  // Quick Preset Helper for Form
  const applyQuickPreset = (name: string, start: string, end: string, days: string) => {
    setFormShiftName(name);
    setFormStartTime(start);
    setFormEndTime(end);
    setFormWorkingDays(days);
  };

  // Start Shift Handler
  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCash = parseFloat(openingCash);
    if (isNaN(parsedCash) || parsedCash < 0) {
      toast.error('Please enter a valid opening cash float');
      return;
    }

    setIsSubmitting(true);
    try {
      const notesWithShiftName = activeShiftNameInput 
        ? `Shift: ${activeShiftNameInput}${shiftNotes ? ` · ${shiftNotes}` : ''}`
        : shiftNotes;

      await startShift(activeShiftType, parsedCash, notesWithShiftName || undefined);
      await queryClient.invalidateQueries({ queryKey: ['shifts'] });
      await queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      setIsStartModalOpen(false);
      toast.success('Shift Started & Drawer Opened!', {
        description: `Starting cash float: ${formatPeso(parsedCash)}`,
      });
    } catch (err: any) {
      toast.error('Failed to start shift', {
        description: err?.message || 'Could not start shift.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // End Shift Handler
  const handleEndShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const parsedCash = parseFloat(actualCash);
    if (isNaN(parsedCash) || parsedCash < 0) {
      toast.error('Please enter the total counted cash in the drawer');
      return;
    }

    const difference = parsedCash - currentExpectedCash;
    setIsSubmitting(true);
    try {
      await endShift(activeShift.id, parsedCash, shiftNotes.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: ['shifts'] });
      await queryClient.invalidateQueries({ queryKey: ['active-shift'] });
      setIsEndModalOpen(false);

      if (difference === 0) {
        toast.success('Shift Closed Perfectly Balanced! 🎉', {
          description: `Total cash drawer: ${formatPeso(parsedCash)}`,
        });
      } else if (difference > 0) {
        toast.info('Shift Closed (Cash Over)', {
          description: `Over by +${formatPeso(difference)} · Total: ${formatPeso(parsedCash)}`,
        });
      } else {
        toast.warning('Shift Closed (Cash Short)', {
          description: `Short by -${formatPeso(Math.abs(difference))} · Total: ${formatPeso(parsedCash)}`,
        });
      }
    } catch (err: any) {
      toast.error('Failed to close shift', {
        description: err?.message || 'Could not close shift.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Shift & Cash Management</h1>
          <p className="text-sm text-muted-foreground">
            Set custom work hours for staff and manage active cash drawer sessions.
          </p>
        </div>

        <div>
          {activeShift ? (
            <Button
              variant="destructive"
              onClick={() => {
                setActualCash(currentExpectedCash.toString());
                setIsEndModalOpen(true);
              }}
              className="gap-2 font-bold shadow-xs"
            >
              <Lock className="h-4 w-4" />
              End Shift & Count Cash
            </Button>
          ) : (
            <Button
              variant="emerald"
              onClick={() => {
                const mySchedule = getStaffSchedule(user?.id || '', user?.role || '');
                setActiveShiftNameInput(mySchedule.shiftName);
                setIsStartModalOpen(true);
              }}
              className="gap-2 font-bold shadow-xs"
            >
              <Clock className="h-4 w-4" />
              Clock In & Open Drawer
            </Button>
          )}
        </div>
      </div>

      {/* 1. ACTIVE SHIFT / CASH DRAWER HERO */}
      <Card className={activeShift ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'}>
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl border ${
                  activeShift
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {activeShift ? (
                  <Sun className="h-7 w-7 text-amber-500 animate-pulse-subtle" />
                ) : (
                  <Clock className="h-7 w-7" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    {activeShift ? `${activeShift.user_name}'s Active Shift` : 'No Active Cashier Shift'}
                  </h2>
                  <Badge
                    variant={activeShift ? 'success' : 'secondary'}
                    className="capitalize font-bold text-xs"
                  >
                    {activeShift ? 'Shift Active / Drawer Open' : 'Drawer Closed'}
                  </Badge>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {activeShift ? (
                    <span>
                      Clocked in at{' '}
                      <span className="font-semibold text-foreground">
                        {formatDateTime(activeShift.start_time)}
                      </span>
                      {activeShift.notes && (
                        <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                          {activeShift.notes}
                        </span>
                      )}
                    </span>
                  ) : (
                    'Clock in to begin taking cash payments and track drawer float.'
                  )}
                </p>
              </div>
            </div>

            {activeShift && (
              <div className="grid grid-cols-3 gap-3 sm:gap-4 bg-background/80 p-3.5 rounded-xl border border-border/70 shadow-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Opening Float
                  </span>
                  <div className="text-sm sm:text-base font-bold font-mono text-foreground mt-0.5">
                    <CurrencyText amount={activeShift.opening_cash} />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                    Cash Sales Added
                  </span>
                  <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +<CurrencyText amount={activeShiftCashSales} />
                  </div>
                </div>

                <div className="border-l border-border pl-3 sm:pl-4">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wide">
                    Expected Drawer
                  </span>
                  <div className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                    <CurrencyText amount={currentExpectedCash} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. CUSTOM STAFF SCHEDULES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Staff Custom Schedules
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Define custom shift titles, work hours, and operating days for each team member.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeProfiles.map((staff) => {
            const sched = getStaffSchedule(staff.id, staff.role);
            const duration = calculateDurationHours(sched.startTime, sched.endTime);
            const isCurrentlyOnDuty = activeShift?.user_id === staff.id;

            return (
              <Card
                key={staff.id}
                className={`transition-all hover:border-emerald-500/40 relative overflow-hidden ${
                  isCurrentlyOnDuty ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/30' : ''
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{staff.full_name}</span>
                        {isCurrentlyOnDuty && (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0">
                            On Duty
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {staff.role === 'owner' ? 'Store Owner / Manager' : 'Cashier / Staff'}
                      </span>
                    </div>

                    {role === 'owner' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditSchedule(staff)}
                        className="gap-1.5 text-xs font-semibold h-8"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit Schedule
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                        Assigned Roster
                      </Badge>
                    )}
                  </div>

                  {/* Custom Schedule Details */}
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-emerald-600" />
                        {sched.shiftName}
                      </span>
                      {duration && (
                        <span className="text-[11px] font-mono font-medium text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                          {duration}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">
                      {formatTime12h(sched.startTime)} – {formatTime12h(sched.endTime)}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                      <span>Days:</span>
                      <span className="font-semibold text-foreground">{sched.workingDays}</span>
                    </div>

                    {sched.notes && (
                      <div className="text-[10px] text-muted-foreground italic truncate">
                        &ldquo;{sched.notes}&rdquo;
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 3. SHIFT AUDIT LOG & HISTORY */}
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Shift & Cash Drawer Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {visibleShifts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {role === 'staff'
                ? 'No shift logs recorded for your account yet. Clock in to begin your shift.'
                : 'No shift logs recorded yet. Clock in to begin tracking cashier sessions.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Notes / Shift</TableHead>
                  <TableHead className="text-right">Opening Float</TableHead>
                  <TableHead className="text-right">Expected Drawer</TableHead>
                  <TableHead className="text-right">Actual Counted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleShifts.map((s) => {
                  const isClosed = s.status === 'closed';
                  const diff = s.cash_difference ?? 0;

                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-mono">
                        <div>{formatDateTime(s.start_time)}</div>
                        {s.end_time && (
                          <div className="text-[11px] text-muted-foreground">
                            to {formatDateTime(s.end_time)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        {s.user_name || 'Staff'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.notes || (
                          <span className="capitalize">{s.shift_type} shift</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatPeso(s.opening_cash)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {s.expected_cash !== null ? formatPeso(s.expected_cash) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {s.actual_cash !== null ? formatPeso(s.actual_cash) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {!isClosed ? (
                          <span className="text-muted-foreground">—</span>
                        ) : diff === 0 ? (
                          <Badge variant="success" className="text-[10px]">
                            Exact (₱0)
                          </Badge>
                        ) : diff > 0 ? (
                          <Badge variant="success" className="text-[10px]">
                            +₱{diff.toFixed(2)}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            -₱{Math.abs(diff).toFixed(2)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={isClosed ? 'secondary' : 'success'}
                          className="capitalize text-[10px]"
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* EDIT CUSTOM SCHEDULE MODAL */}
      <Dialog open={isEditScheduleOpen} onOpenChange={setIsEditScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              Set Custom Schedule
            </DialogTitle>
            <DialogDescription>
              Configure custom shift hours and working days for {editingStaff?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Quick Templates Buttons */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Quick Template Presets:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickPreset('Morning Shift', '08:00', '16:00', 'Monday – Saturday')}
                  className="text-xs py-1 h-7"
                >
                  ☀️ 8 AM – 4 PM
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickPreset('Evening / Closing', '16:00', '00:00', 'Monday – Saturday')}
                  className="text-xs py-1 h-7"
                >
                  🌙 4 PM – 12 AM
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickPreset('Mid Shift', '11:00', '19:00', 'Monday – Saturday')}
                  className="text-xs py-1 h-7"
                >
                  ⚡ 11 AM – 7 PM
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyQuickPreset('Full Day / Manager', '08:00', '20:00', 'Everyday')}
                  className="text-xs py-1 h-7"
                >
                  👑 All-Day
                </Button>
              </div>
            </div>

            {/* Custom Shift Name */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Custom Shift Name / Title
              </label>
              <Input
                type="text"
                value={formShiftName}
                onChange={(e) => setFormShiftName(e.target.value)}
                placeholder="e.g. Opening Cashier, Night Cook"
                required
              />
            </div>

            {/* Custom Start & End Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  required
                  className="font-mono"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  {formatTime12h(formStartTime)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  End Time
                </label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  required
                  className="font-mono"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  {formatTime12h(formEndTime)}
                </span>
              </div>
            </div>

            {/* Working Days */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Working Days
              </label>
              <Input
                type="text"
                value={formWorkingDays}
                onChange={(e) => setFormWorkingDays(e.target.value)}
                placeholder="e.g. Monday – Saturday, Mon/Wed/Fri, Everyday"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Schedule Notes (Optional)
              </label>
              <Input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. 1 hour lunch break at 12 PM"
              />
            </div>

            {/* Live Preview Summary */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                Summary Preview:
              </span>
              <div className="text-foreground">
                <span className="font-bold">{formShiftName || 'Custom Shift'}</span>: {formatTime12h(formStartTime)} – {formatTime12h(formEndTime)}{' '}
                ({calculateDurationHours(formStartTime, formEndTime)}) · {formWorkingDays}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditScheduleOpen(false)}>
              Cancel
            </Button>
            <Button variant="emerald" onClick={handleSaveCustomSchedule} className="font-bold">
              Save Custom Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLOCK IN / START SHIFT MODAL */}
      <Dialog open={isStartModalOpen} onOpenChange={setIsStartModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              Clock In & Open Drawer
            </DialogTitle>
            <DialogDescription>
              Confirm your shift details and opening cash float.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStartShift} className="space-y-4 py-2">
            {/* Logged in Staff Identity */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/80 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Starting shift as:</span>
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>{user?.full_name || 'Staff Member'}</span>
                <Badge variant="outline" className="text-[10px] capitalize ml-1">
                  {role}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Shift Label / Role
              </label>
              <Input
                type="text"
                value={activeShiftNameInput}
                onChange={(e) => setActiveShiftNameInput(e.target.value)}
                placeholder="e.g. Morning Cashier, Night Shift"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Opening Cash Float (₱)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="1000.00"
                required
                className="font-mono text-base"
              />
              <div className="flex gap-1.5 mt-2">
                {[500, 1000, 1500, 2000].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpeningCash(preset.toString())}
                    className="text-xs py-1 h-7"
                  >
                    ₱{preset}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Shift Notes (Optional)
              </label>
              <Input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="e.g. Starting register with extra coins"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStartModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={isSubmitting} className="font-bold">
                {isSubmitting ? 'Clocking in...' : 'Clock In & Open Drawer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* END SHIFT / CASH COUNT MODAL */}
      <Dialog open={isEndModalOpen} onOpenChange={setIsEndModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Lock className="h-5 w-5" />
              End Shift & Count Drawer Cash
            </DialogTitle>
            <DialogDescription>
              Count all physical cash and coins currently inside the register drawer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEndShift} className="space-y-4 py-2">
            <div className="bg-muted/50 p-3.5 rounded-xl border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening Cash Float:</span>
                <span className="font-mono font-semibold">{formatPeso(activeShift?.opening_cash || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash Sales Recorded:</span>
                <span className="font-mono font-semibold text-emerald-600">
                  +{formatPeso(activeShiftCashSales)}
                </span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-border text-sm">
                <span>Expected Cash Total:</span>
                <span className="font-mono text-foreground">{formatPeso(currentExpectedCash)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Actual Physical Cash Counted (₱)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder={currentExpectedCash.toString()}
                required
                className="font-mono text-base font-bold"
              />
            </div>

            {actualCash && !isNaN(parseFloat(actualCash)) && (
              <div
                className={`p-3 rounded-lg text-xs font-medium border flex items-center justify-between ${
                  parseFloat(actualCash) - currentExpectedCash === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : parseFloat(actualCash) - currentExpectedCash > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                <span>Calculated Drawer Variance:</span>
                <span className="font-mono font-bold">
                  {parseFloat(actualCash) - currentExpectedCash === 0
                    ? 'Exact Balanced (₱0.00)'
                    : parseFloat(actualCash) - currentExpectedCash > 0
                    ? `Over: +${formatPeso(parseFloat(actualCash) - currentExpectedCash)}`
                    : `Short: -${formatPeso(Math.abs(parseFloat(actualCash) - currentExpectedCash))}`}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">
                Closing Notes (Optional)
              </label>
              <Input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="e.g. Deposit prepared for bank"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEndModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
                className="font-bold"
              >
                {isSubmitting ? 'Closing Shift...' : 'Confirm & Close Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
