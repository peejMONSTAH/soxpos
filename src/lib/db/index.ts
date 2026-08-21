/**
 * Modular Database Layer & Service Facade
 * Provides unified access to repositories with offline LocalStorage fallback + Supabase synchronization
 */

export * from './storage';
export * from './repositories/business.repo';
export * from './repositories/profiles.repo';
export * from './repositories/categories.repo';
export * from './repositories/products.repo';
export * from './repositories/shifts.repo';
export * from './repositories/sales.repo';
export * from './repositories/movements.repo';
export * from './repositories/expenses.repo';
export * from './repositories/audit-logs.repo';

import { businessRepo } from './repositories/business.repo';
import { profilesRepo } from './repositories/profiles.repo';
import { categoriesRepo } from './repositories/categories.repo';
import { productsRepo } from './repositories/products.repo';
import { shiftsRepo } from './repositories/shifts.repo';
import { salesRepo } from './repositories/sales.repo';
import { movementsRepo } from './repositories/movements.repo';
import { expensesRepo } from './repositories/expenses.repo';
import { auditLogsRepo } from './repositories/audit-logs.repo';
import { syncLocalToSupabase } from './storage';

/**
 * Unified `dbService` facade
 * Maintains 100% backward compatibility with all components and stores
 */
export const dbService = {
  // Business & Settings
  getBusiness: businessRepo.getBusiness.bind(businessRepo),
  updateBusiness: businessRepo.updateBusiness.bind(businessRepo),

  // Users & Profiles
  getProfiles: profilesRepo.getProfiles.bind(profilesRepo),
  getCurrentProfile: profilesRepo.getCurrentProfile.bind(profilesRepo),
  setCurrentProfile: profilesRepo.setCurrentProfile.bind(profilesRepo),
  switchProfile: profilesRepo.switchProfile.bind(profilesRepo),
  createProfile: profilesRepo.createProfile.bind(profilesRepo),
  updateProfile: profilesRepo.updateProfile.bind(profilesRepo),
  deleteProfile: profilesRepo.deleteProfile.bind(profilesRepo),

  // Categories
  getCategories: categoriesRepo.getCategories.bind(categoriesRepo),
  createCategory: categoriesRepo.createCategory.bind(categoriesRepo),
  updateCategory: categoriesRepo.updateCategory.bind(categoriesRepo),
  deleteCategory: categoriesRepo.deleteCategory.bind(categoriesRepo),

  // Products & Inventory
  getProducts: productsRepo.getProducts.bind(productsRepo),
  createProduct: productsRepo.createProduct.bind(productsRepo),
  updateProduct: productsRepo.updateProduct.bind(productsRepo),
  archiveProduct: productsRepo.archiveProduct.bind(productsRepo),
  restoreProduct: productsRepo.restoreProduct.bind(productsRepo),
  deleteProduct: productsRepo.deleteProduct.bind(productsRepo),

  // Inventory Movements
  getInventoryMovements: movementsRepo.getInventoryMovements.bind(movementsRepo),
  recordStockMovement: movementsRepo.recordStockMovement.bind(movementsRepo),

  // Shifts & Roster
  getShifts: shiftsRepo.getShifts.bind(shiftsRepo),
  getActiveShift: shiftsRepo.getActiveShift.bind(shiftsRepo),
  startShift: shiftsRepo.startShift.bind(shiftsRepo),
  endShift: shiftsRepo.endShift.bind(shiftsRepo),
  closeShift: shiftsRepo.closeShift.bind(shiftsRepo),
  deleteShift: shiftsRepo.deleteShift.bind(shiftsRepo),
  getShiftSchedules: shiftsRepo.getShiftSchedules.bind(shiftsRepo),
  createShiftSchedule: shiftsRepo.createShiftSchedule.bind(shiftsRepo),
  updateShiftSchedule: shiftsRepo.updateShiftSchedule.bind(shiftsRepo),
  deleteShiftSchedule: shiftsRepo.deleteShiftSchedule.bind(shiftsRepo),

  // Sales & Transactions
  getSales: salesRepo.getSales.bind(salesRepo),
  createSale: salesRepo.createSale.bind(salesRepo),
  updateSaleStatus: salesRepo.updateSaleStatus.bind(salesRepo),
  voidSale: salesRepo.voidSale.bind(salesRepo),
  getVoidedSales: salesRepo.getVoidedSales.bind(salesRepo),
  deleteSale: salesRepo.deleteSale.bind(salesRepo),

  // Expenses
  getExpenses: expensesRepo.getExpenses.bind(expensesRepo),
  createExpense: expensesRepo.createExpense.bind(expensesRepo),
  updateExpense: expensesRepo.updateExpense.bind(expensesRepo),
  deleteExpense: expensesRepo.deleteExpense.bind(expensesRepo),

  // Audit Logs
  getAuditLogs: auditLogsRepo.getAuditLogs.bind(auditLogsRepo),
  logAudit: auditLogsRepo.logAudit.bind(auditLogsRepo),

  // Cloud Sync
  syncLocalToSupabase,
};
