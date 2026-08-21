'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { useAuthStore } from '@/stores/authStore';
import { Expense, ExpenseCategory } from '@/types/database.types';
import { formatPeso, formatDate } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CurrencyText } from '@/components/ui/currency-text';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Receipt,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Supplies',
  'Utilities',
  'Rent',
  'Transportation',
  'Maintenance',
  'Salaries',
  'Other',
];

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const { role } = useAuthStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Supplies');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');

  // Fetch Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => dbService.getExpenses(),
  });

  // Calculate totals & category breakdowns
  const { totalExpenseAmount, categoryTotals } = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const catMap: Record<string, number> = {};
    expenses.forEach((e) => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
    return { totalExpenseAmount: total, categoryTotals: catMap };
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedCatFilter !== 'all' && e.category !== selectedCatFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          e.description.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, selectedCatFilter, searchQuery]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim()) {
      toast.error('Please enter an expense description');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await dbService.createExpense({
        description: description.trim(),
        category,
        amount: numAmount,
        date,
        notes: notes.trim() || undefined,
      });

      toast.success('Expense Recorded');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsModalOpen(false);
      setDescription('');
      setAmount('');
      setNotes('');
    } catch (err: any) {
      toast.error('Failed to record expense', { description: err?.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await dbService.deleteExpense(id);
      toast.info('Expense Deleted');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    } catch (err: any) {
      toast.error('Failed to delete expense', { description: err?.message });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Business Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Record operating costs, store supplies, utilities, and maintain accurate profit reports.
          </p>
        </div>

        <Button
          variant="emerald"
          onClick={() => setIsModalOpen(true)}
          className="gap-2 font-semibold shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Record Expense
        </Button>
      </div>

      {/* Expense KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="sm:col-span-1 bg-rose-500/5 border-rose-500/20">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Total Recorded Expenses
            </span>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">
              <CurrencyText amount={totalExpenseAmount} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deducted from gross profit calculations
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top Expense Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((cat) => {
                const catTotal = categoryTotals[cat] || 0;
                if (catTotal === 0) return null;
                return (
                  <div
                    key={cat}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 text-xs border border-border"
                  >
                    <span className="font-semibold text-foreground">{cat}:</span>
                    <CurrencyText amount={catTotal} className="font-bold text-rose-600 dark:text-rose-400" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by description or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedCatFilter} onValueChange={setSelectedCatFilter}>
          <SelectTrigger className="w-48 bg-card">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardContent className="p-0">
          {filteredExpenses.length === 0 ? (
            <EmptyState
              title="No expenses recorded"
              description="Record store expenses to accurately calculate net store profit."
              actionLabel="Record Expense"
              onAction={() => setIsModalOpen(true)}
              className="m-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(expense.date)}
                    </TableCell>

                    <TableCell className="font-semibold text-foreground">
                      {expense.description}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {expense.category}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{formatPeso(expense.amount)}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {expense.notes || '—'}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {expense.created_by_name || 'Owner'}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete expense"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Expense Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-rose-600" />
              <span>Record Store Expense</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateExpense} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Expense Description *
              </label>
              <Input
                type="text"
                placeholder="e.g. Medium Sando Bags & Packaging Tape"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Category *
                </label>
                <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">
                  Amount (₱) *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7 font-semibold"
                    required
                  />
                  <span className="absolute left-2.5 top-2.5 text-xs font-bold text-muted-foreground">
                    ₱
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground mb-1 block">
                Expense Date *
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Notes / Official Receipt # (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Purchased at Divisoria wholesale"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
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
                {isSubmitting ? 'Saving...' : 'Record Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
