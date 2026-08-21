'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dbService } from '@/lib/db';
import { formatPeso, formatDate } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  BarChart3,
  Download,
  DollarSign,
  TrendingUp,
  Receipt,
  Boxes,
  PieChart,
  FileText,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportSalesToCSV, exportInventoryToCSV, exportExpensesToCSV } from '@/lib/export-utils';
import { ReadingModal } from '@/components/reports/ReadingModal';


export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');

  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [readingType, setReadingType] = useState<'X' | 'Z'>('X');

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

  const { data: business } = useQuery({
    queryKey: ['business'],
    queryFn: () => dbService.getBusiness(),
  });

  const { data: activeShift } = useQuery({
    queryKey: ['active-shift'],
    queryFn: () => dbService.getActiveShift(),
  });

  // Report calculations
  const report = useMemo(() => {
    const completedSales = sales.filter((s) => s.status === 'completed');

    // Sales metrics
    const grossSales = completedSales.reduce((sum, s) => sum + s.subtotal, 0);
    const totalDiscounts = completedSales.reduce((sum, s) => sum + s.discount, 0);
    const netSales = completedSales.reduce((sum, s) => sum + s.total, 0);
    const totalTransactions = completedSales.length;
    const avgTransaction = totalTransactions > 0 ? netSales / totalTransactions : 0;

    // Payment method breakdown
    const paymentBreakdown: Record<string, { count: number; total: number }> = {
      cash: { count: 0, total: 0 },
      gcash: { count: 0, total: 0 },
      maya: { count: 0, total: 0 },
      other: { count: 0, total: 0 },
    };

    completedSales.forEach((s) => {
      const mode = s.payment_method || 'other';
      if (!paymentBreakdown[mode]) paymentBreakdown[mode] = { count: 0, total: 0 };
      paymentBreakdown[mode].count += 1;
      paymentBreakdown[mode].total += s.total;
    });

    // Product performance & Kitchen vs Store breakdown
    let storeRevenue = 0;
    let kitchenRevenue = 0;
    let kitchenMealCount = 0;

    const productStats: Record<
      string,
      { name: string; is_kitchen?: boolean; category?: string; qty: number; revenue: number; cogs: number; profit: number }
    > = {};

    completedSales.forEach((s) => {
      s.items?.forEach((i) => {
        const name = i.product_name_snapshot;
        const matchingProd = products.find((p) => p.id === i.product_id || p.name === name);
        const isKitchen = matchingProd?.is_kitchen || matchingProd?.category_id === 'cat-kitchen' || name.toLowerCase().includes('silog') || name.toLowerCase().includes('meal') || name.toLowerCase().includes('pancit') || name.toLowerCase().includes('halo-halo');

        if (isKitchen) {
          kitchenRevenue += i.subtotal;
          kitchenMealCount += i.quantity;
        } else {
          storeRevenue += i.subtotal;
        }

        if (!productStats[name]) {
          productStats[name] = {
            name,
            is_kitchen: isKitchen,
            category: matchingProd?.category_name || 'General',
            qty: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
          };
        }

        const cost = matchingProd?.cost_price || 0;
        productStats[name].qty += i.quantity;
        productStats[name].revenue += i.subtotal;
        productStats[name].cogs += cost * i.quantity;
        productStats[name].profit += i.subtotal - cost * i.quantity;
      });
    });

    const productRankings = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

    // Cost & Profit aggregations
    const totalCOGS = Object.values(productStats).reduce((sum, p) => sum + p.cogs, 0);
    const grossProfit = netSales - totalCOGS;
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const estimatedNetProfit = grossProfit - totalExpenses;

    // Inventory valuations
    const totalInventoryUnits = products.reduce((sum, p) => sum + p.stock_quantity, 0);
    const inventoryCostValuation = products.reduce((sum, p) => sum + p.stock_quantity * p.cost_price, 0);
    const inventoryRetailValuation = products.reduce((sum, p) => sum + p.stock_quantity * p.selling_price, 0);

    return {
      grossSales,
      totalDiscounts,
      netSales,
      totalTransactions,
      avgTransaction,
      paymentBreakdown,
      storeRevenue,
      kitchenRevenue,
      kitchenMealCount,
      productRankings,
      totalCOGS,
      grossProfit,
      totalExpenses,
      estimatedNetProfit,
      totalInventoryUnits,
      inventoryCostValuation,
      inventoryRetailValuation,
    };
  }, [sales, products, expenses]);

  const handleExportCSV = () => {
    if (activeTab === 'sales') {
      exportSalesToCSV(sales);
      toast.success('Sales transactions exported to CSV');
    } else if (activeTab === 'products') {
      exportInventoryToCSV(products);
      toast.success('Product inventory catalog exported to CSV');
    } else {
      exportExpensesToCSV(expenses);
      toast.success('Store expenses log exported to CSV');
    }
  };

  const openReading = (type: 'X' | 'Z') => {
    setReadingType(type);
    setReadingModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial & Sales Reports</h1>
          <p className="text-sm text-muted-foreground">
            Analyze sales performance, product velocity, cost of goods, and estimated store profits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* X-Reading Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReading('X')}
            className="gap-1.5 font-medium border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10"
          >
            <FileText className="h-4 w-4 text-emerald-600" />
            X-Reading (Mid-Shift)
          </Button>

          {/* Z-Reading Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReading('Z')}
            className="gap-1.5 font-medium border-amber-600/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
          >
            <Printer className="h-4 w-4 text-amber-600" />
            Z-Reading (End-of-Day)
          </Button>

          {/* CSV Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 font-semibold"
          >
            <Download className="h-4 w-4" />
            Export {activeTab === 'sales' ? 'Sales' : activeTab === 'products' ? 'Products' : 'Expenses'} CSV
          </Button>
        </div>
      </div>

      <ReadingModal
        isOpen={readingModalOpen}
        onClose={() => setReadingModalOpen(false)}
        type={readingType}
        sales={sales}
        shift={activeShift}
        business={business}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="sales">Sales Summary</TabsTrigger>
          <TabsTrigger value="products">Product Performance</TabsTrigger>
          <TabsTrigger value="profit">Profit & Loss (P&L)</TabsTrigger>
        </TabsList>

        {/* Tab 1: Sales Summary */}
        <TabsContent value="sales" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground">Gross Sales</span>
                <div className="text-xl font-bold text-foreground mt-1">
                  <CurrencyText amount={report.grossSales} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground">Discounts Deducted</span>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  -<CurrencyText amount={report.totalDiscounts} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-4">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Net Sales Revenue
                </span>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                  <CurrencyText amount={report.netSales} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground">Avg. Transaction Value</span>
                <div className="text-xl font-bold text-foreground mt-1">
                  <CurrencyText amount={report.avgTransaction} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Store vs Kitchen Orders Revenue Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                    🏪 Store / Retail Groceries
                  </span>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                    <CurrencyText amount={report.storeRevenue} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Retail grocery & merchandise revenue
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                    🍳 Kitchen Cooked Meals & Food
                  </span>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    <CurrencyText amount={report.kitchenRevenue} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {report.kitchenMealCount} meal orders prepared
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Method Breakdown Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                Sales Breakdown by Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-center">Transaction Count</TableHead>
                    <TableHead className="text-right">Total Collected</TableHead>
                    <TableHead className="text-right">% Share of Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.paymentBreakdown).map(([mode, data]) => {
                    const share = report.netSales > 0 ? (data.total / report.netSales) * 100 : 0;
                    return (
                      <TableRow key={mode}>
                        <TableCell className="font-semibold uppercase text-xs">
                          <Badge
                            variant={
                              mode === 'cash'
                                ? 'cash'
                                : mode === 'gcash'
                                ? 'gcash'
                                : mode === 'maya'
                                ? 'maya'
                                : 'other'
                            }
                          >
                            {mode}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium">
                          {data.count}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-foreground">
                          {formatPeso(data.total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground font-semibold">
                          {share.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Product Performance */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Product Sales Rankings & Velocity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-center">Units Sold</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Estimated COGS</TableHead>
                    <TableHead className="text-right">Estimated Gross Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.productRankings.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.is_kitchen && (
                            <span className="text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                              🍳 Kitchen Meal
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{p.qty}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs text-foreground">
                        {formatPeso(p.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatPeso(p.cogs)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                        {formatPeso(p.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Profit & Loss */}
        <TabsContent value="profit" className="space-y-4">
          <Card className="max-w-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Estimated Profit & Loss Statement (P&L)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Formula: Gross Revenue − Cost of Goods Sold (COGS) − Operating Expenses = Estimated Net Profit.
              </p>
            </CardHeader>

            <CardContent className="p-5 space-y-3.5">
              <div className="flex justify-between items-center text-sm py-1">
                <span className="font-medium text-foreground">1. Total Net Sales Revenue:</span>
                <span className="font-mono font-bold text-foreground">{formatPeso(report.netSales)}</span>
              </div>

              <div className="flex justify-between items-center text-sm py-1 text-muted-foreground">
                <span>2. Less: Cost of Goods Sold (COGS):</span>
                <span className="font-mono font-medium text-rose-600">-{formatPeso(report.totalCOGS)}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-semibold py-2 px-3 rounded-lg bg-muted/40 border border-border/80">
                <span>Gross Profit Margin:</span>
                <span className="font-mono text-foreground">{formatPeso(report.grossProfit)}</span>
              </div>

              <div className="flex justify-between items-center text-sm py-1 text-muted-foreground">
                <span>3. Less: Store Operating Expenses:</span>
                <span className="font-mono font-medium text-rose-600">-{formatPeso(report.totalExpenses)}</span>
              </div>

              <div className="flex justify-between items-center text-base font-black py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                <span>ESTIMATED NET PROFIT:</span>
                <span className="text-xl font-mono">{formatPeso(report.estimatedNetProfit)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
