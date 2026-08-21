'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { formatPeso, formatDate, formatTime } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CurrencyText } from '@/components/ui/currency-text';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  Receipt,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  Package,
  Clock,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [chartPeriod, setChartPeriod] = useState<'today' | '7days' | '30days'>('7days');

  // Fetch Sales, Products, Expenses, Shifts
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => dbService.getSales(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => dbService.getProducts(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => dbService.getExpenses(),
  });

  // Calculate Dashboard Summary KPIs
  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Today's Sales
    const todaySalesList = sales.filter(
      (s) => s.status === 'completed' && s.created_at.startsWith(todayStr)
    );
    const todaySales = todaySalesList.reduce((sum, s) => sum + s.total, 0);
    const todayTransactions = todaySalesList.length;
    const averageSale = todayTransactions > 0 ? todaySales / todayTransactions : 0;

    // Estimated Profit Calculation:
    // Profit = Total Sales Revenue - COGS (Cost of goods sold) - Total Expenses
    let totalRevenue = 0;
    let totalCOGS = 0;

    sales
      .filter((s) => s.status === 'completed')
      .forEach((sale) => {
        totalRevenue += sale.total;
        sale.items?.forEach((item) => {
          totalCOGS += item.quantity * item.cost_price_snapshot;
        });
      });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const estimatedNetProfit = Math.max(0, totalRevenue - totalCOGS - totalExpenses);

    // Urgent Low stock products (count and top 4)
    const lowStockItems = products.filter(
      (p) => p.status === 'active' && p.stock_quantity <= p.minimum_stock
    );

    // Top Selling Products (by sold quantity)
    const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach((s) => {
      s.items?.forEach((i) => {
        const prodName = i.product_name_snapshot;
        if (!productSalesMap[prodName]) {
          productSalesMap[prodName] = { name: prodName, qty: 0, revenue: 0 };
        }
        productSalesMap[prodName].qty += i.quantity;
        productSalesMap[prodName].revenue += i.subtotal;
      });
    });

    const topSelling = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      todaySales,
      todayTransactions,
      averageSale,
      estimatedNetProfit,
      lowStockItems,
      topSelling,
    };
  }, [sales, products, expenses]);

  // Chart data dynamic calculation from real sales
  const chartData = useMemo(() => {
    if (chartPeriod === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySalesList = sales.filter(
        (s) => s.status === 'completed' && s.created_at.startsWith(todayStr)
      );

      const slots = [
        { name: '8AM', start: 8, end: 10 },
        { name: '10AM', start: 10, end: 12 },
        { name: '12PM', start: 12, end: 14 },
        { name: '2PM', start: 14, end: 16 },
        { name: '4PM', start: 16, end: 18 },
        { name: '6PM', start: 18, end: 20 },
        { name: '8PM', start: 20, end: 22 },
      ];

      return slots.map((slot) => {
        const slotTotal = todaySalesList
          .filter((s) => {
            const h = new Date(s.created_at).getHours();
            return h >= slot.start && h < slot.end;
          })
          .reduce((sum, s) => sum + s.total, 0);

        return { name: slot.name, sales: slotTotal };
      });
    } else if (chartPeriod === '7days') {
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

        const dayTotal = sales
          .filter((s) => s.status === 'completed' && s.created_at.startsWith(dateStr))
          .reduce((sum, s) => sum + s.total, 0);

        result.push({ name: dayLabel, sales: dayTotal });
      }
      return result;
    } else {
      // 30 days (last 4 weeks)
      const weeks = [
        { name: '3 Wks Ago', daysAgoStart: 28, daysAgoEnd: 21 },
        { name: '2 Wks Ago', daysAgoStart: 21, daysAgoEnd: 14 },
        { name: 'Last Wk', daysAgoStart: 14, daysAgoEnd: 7 },
        { name: 'This Wk', daysAgoStart: 7, daysAgoEnd: 0 },
      ];

      return weeks.map((w) => {
        const now = Date.now();
        const startMs = now - w.daysAgoStart * 86400000;
        const endMs = now - w.daysAgoEnd * 86400000;

        const total = sales
          .filter((s) => {
            if (s.status !== 'completed') return false;
            const t = new Date(s.created_at).getTime();
            return t >= startMs && t <= endMs;
          })
          .reduce((sum, s) => sum + s.total, 0);

        return { name: w.name, sales: total };
      });
    }
  }, [chartPeriod, sales]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Business Overview</h1>
          <p className="text-sm text-muted-foreground">
            Live business performance, real-time sales metrics, and store operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pos">
            <Button variant="emerald" className="gap-2 font-semibold shadow-xs">
              <ShoppingCart className="h-4 w-4" />
              Open POS Terminal
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <Card className="bg-gradient-to-br from-card to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Today&apos;s Gross Sales</span>
              <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-2">
              <CurrencyText amount={kpis.todaySales} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From {kpis.todayTransactions} completed transactions
            </p>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Total Transactions</span>
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
              {kpis.todayTransactions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Customer checkouts today
            </p>
          </CardContent>
        </Card>

        {/* Average Sale Value */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Average Basket Size</span>
              <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600">
                <ShoppingCart className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
              <CurrencyText amount={kpis.averageSale} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average spent per customer
            </p>
          </CardContent>
        </Card>

        {/* Estimated Profit */}
        <Card className="bg-gradient-to-br from-card to-primary/5 border-primary/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Estimated Net Profit</span>
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-foreground mt-2">
              <CurrencyText amount={kpis.estimatedNetProfit} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue - COGS - Expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Side widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Overview Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Sales Revenue Overview</CardTitle>
              <p className="text-xs text-muted-foreground">
                Revenue trends across selected operating period.
              </p>
            </div>

            {/* Time Period Filter */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs">
              <button
                onClick={() => setChartPeriod('today')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  chartPeriod === 'today'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setChartPeriod('7days')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  chartPeriod === '7days'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartPeriod('30days')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  chartPeriod === '30days'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                30 Days
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                    tickFormatter={(val) => `₱${val}`}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatPeso(value), 'Revenue']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#059669"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#salesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Top Selling Products</span>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">Most popular items by volume sold.</p>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-3">
            {kpis.topSelling.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No product sales recorded yet.
              </div>
            ) : (
              kpis.topSelling.map((prod, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 font-bold text-emerald-700 dark:text-emerald-300 text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-foreground truncate">{prod.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-foreground">{prod.qty} sold</div>
                    <div className="text-[11px] text-muted-foreground">
                      <CurrencyText amount={prod.revenue} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Low Stock Alert & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card className={kpis.lowStockItems.length > 0 ? 'border-amber-500/30' : ''}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Low Stock & Reorder Watchlist</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Items requiring restock from suppliers.
              </p>
            </div>
            <Link href="/inventory">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <span>View Inventory</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-2.5">
            {kpis.lowStockItems.length === 0 ? (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs">
                <Sparkles className="h-4 w-4" />
                <span>All items are comfortably in stock. No urgent reorders needed.</span>
              </div>
            ) : (
              kpis.lowStockItems.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">
                      Min threshold: {item.minimum_stock} {item.unit}s
                    </div>
                  </div>
                  <div>
                    <Badge variant={item.stock_quantity <= 0 ? 'destructive' : 'warning'}>
                      {item.stock_quantity <= 0 ? 'Out of stock' : `${item.stock_quantity} left`}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>Recent Completed Sales</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Latest transactions from cashier terminals.
              </p>
            </div>
            <Link href="/sales">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <span>All Sales</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="p-4 pt-0 space-y-2.5">
            {sales.slice(0, 4).map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/60 text-xs"
              >
                <div>
                  <div className="font-mono font-bold text-foreground">{sale.receipt_number}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatTime(sale.created_at)} · Cashier: {sale.user_name || 'Staff'}
                  </div>
                </div>
                <div className="text-right">
                  <CurrencyText
                    amount={sale.total}
                    className="font-bold text-emerald-700 dark:text-emerald-400 text-sm"
                  />
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                    {sale.payment_method}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
