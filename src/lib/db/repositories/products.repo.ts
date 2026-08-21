import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Product, Category } from '@/types/database.types';
import { SEED_BUSINESS, SEED_CATEGORIES } from '@/lib/seed-data';
import { KEYS, generateUUID, getStorage, setStorage, ensureBusinessInSupabase } from '../storage';
import { auditLogsRepo } from './audit-logs.repo';
import { movementsRepo } from './movements.repo';

function cleanCategoryId(catId?: string | null): string | null {
  if (!catId) return null;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catId);
  if (isUUID) return catId;
  if (catId === 'cat-kitchen') return 'c0000000-0000-0000-0000-000000000002';
  if (catId === 'cat-store') return 'c0000000-0000-0000-0000-000000000001';
  return null;
}

export const productsRepo = {
  async getProducts(): Promise<Product[]> {
    const localProds = getStorage<Product[]>(KEYS.PRODUCTS, []);
    const categories = getStorage<Category[]>(KEYS.CATEGORIES, SEED_CATEGORIES);
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, categories(name)')
          .order('name', { ascending: true });
        if (data && !error) {
          const mapped = data.map((p: any) => ({
            ...p,
            category_name: p.categories?.name || (p.category_id ? catMap.get(p.category_id) : (p.is_kitchen ? 'Kitchen Meals & Cooked Food' : 'General Store Items')),
          })) as Product[];
          setStorage(KEYS.PRODUCTS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Error loading products from Supabase:', err);
      }
    }

    return localProds.map((p) => ({
      ...p,
      category_name: p.category_id ? catMap.get(p.category_id) || (p.is_kitchen ? 'Kitchen Meals & Cooked Food' : 'General Store Items') : (p.is_kitchen ? 'Kitchen Meals & Cooked Food' : 'General Store Items'),
    }));
  },

  async createProduct(
    product: Omit<Product, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Product> {
    const businessId = product.business_id || SEED_BUSINESS.id;
    let safeCategoryId = cleanCategoryId(product.category_id);
    const isKitchenProduct = Boolean(
      product.is_kitchen ||
      product.category_id === 'cat-kitchen' ||
      safeCategoryId === 'c0000000-0000-0000-0000-000000000002'
    );

    if (isKitchenProduct && !safeCategoryId) {
      safeCategoryId = 'c0000000-0000-0000-0000-000000000002';
    }

    const newProduct: Product = {
      ...product,
      category_id: safeCategoryId,
      is_kitchen: isKitchenProduct,
      business_id: businessId,
      id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const products = getStorage<Product[]>(KEYS.PRODUCTS, []);
    products.push(newProduct);
    setStorage(KEYS.PRODUCTS, products);

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(businessId);

        if (newProduct.category_id) {
          const cats = getStorage<Category[]>(KEYS.CATEGORIES, SEED_CATEGORIES);
          const cat = cats.find((c) => c.id === newProduct.category_id);
          if (cat) {
            await supabase.from('categories').upsert(
              {
                id: cat.id,
                business_id: businessId,
                name: cat.name,
                description: cat.description || null,
                is_active: cat.is_active ?? true,
                is_kitchen: cat.is_kitchen ?? false,
              },
              { onConflict: 'id' }
            );
          }
        }

        let insertPayload: any = {
          id: newProduct.id,
          business_id: businessId,
          category_id: safeCategoryId,
          name: newProduct.name,
          description: newProduct.description || null,
          selling_price: newProduct.selling_price,
          cost_price: newProduct.cost_price,
          stock_quantity: newProduct.stock_quantity,
          minimum_stock: newProduct.minimum_stock,
          unit: newProduct.unit || 'piece',
          image_url: newProduct.image_url || null,
          is_kitchen: isKitchenProduct,
          has_drink_option: Boolean(newProduct.has_drink_option),
          status: newProduct.status || 'active',
        };

        let { data, error } = await supabase
          .from('products')
          .insert(insertPayload)
          .select()
          .single();

        // If Supabase schema does not have has_drink_option column yet, retry without it
        if (error && error.message.includes('has_drink_option')) {
          delete insertPayload.has_drink_option;
          const retryRes = await supabase
            .from('products')
            .insert(insertPayload)
            .select()
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (error) {
          console.error('Supabase product insert error:', error.message, error.details, error.hint);
          throw new Error(error.message);
        } else if (data) {
          const index = products.findIndex((p) => p.id === newProduct.id);
          if (index !== -1) {
            products[index] = { ...data, has_drink_option: Boolean(newProduct.has_drink_option) } as Product;
            setStorage(KEYS.PRODUCTS, products);
          }
          return { ...data, has_drink_option: Boolean(newProduct.has_drink_option) } as Product;
        }
      } catch (err: any) {
        console.error('Supabase product create exception:', err);
        throw err;
      }
    }

    if (newProduct.stock_quantity > 0) {
      await movementsRepo.recordStockMovement({
        product_id: newProduct.id,
        type: 'STOCK_IN',
        quantity: newProduct.stock_quantity,
        previous_stock: 0,
        new_stock: newProduct.stock_quantity,
        reference_id: 'INITIAL_STOCK',
        reason: 'Initial stock on product creation',
      });
    }

    await auditLogsRepo.logAudit({
      action: 'CREATE_PRODUCT',
      entity: 'PRODUCT',
      entity_id: newProduct.id,
      details: {
        name: newProduct.name,
        price: newProduct.selling_price,
        stock: newProduct.stock_quantity,
      },
    });
    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const targetCatId = updates.category_id !== undefined ? cleanCategoryId(updates.category_id) : undefined;
    const cats = getStorage<Category[]>(KEYS.CATEGORIES, SEED_CATEGORIES);
    const catMap = new Map(cats.map((c) => [c.id, c.name]));
    const targetCatName = targetCatId ? catMap.get(targetCatId) : undefined;

    const sanitizedUpdates: Partial<Product> = {
      ...updates,
      ...(targetCatId !== undefined ? { category_id: targetCatId } : {}),
      ...(targetCatName ? { category_name: targetCatName } : {}),
      updated_at: new Date().toISOString(),
    };

    const products = getStorage<Product[]>(KEYS.PRODUCTS, []);
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      const old = products[index];
      products[index] = {
        ...old,
        ...sanitizedUpdates,
        category_name: targetCatName || old.category_name || (sanitizedUpdates.is_kitchen ? 'Kitchen Meals & Cooked Food' : 'General Store Items'),
      };
      setStorage(KEYS.PRODUCTS, products);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        if (targetCatId) {
          const cat = cats.find((c) => c.id === targetCatId);
          if (cat) {
            await supabase.from('categories').upsert(
              {
                id: cat.id,
                business_id: cat.business_id || SEED_BUSINESS.id,
                name: cat.name,
                description: cat.description || null,
                is_active: cat.is_active ?? true,
                is_kitchen: cat.is_kitchen ?? false,
              },
              { onConflict: 'id' }
            );
          }
        }

        // Clean out virtual/computed properties before updating Supabase table
        const dbPayload: any = { ...sanitizedUpdates };
        delete dbPayload.category_name;
        delete dbPayload.categories;

        let { data, error } = await supabase
          .from('products')
          .update(dbPayload)
          .eq('id', id)
          .select('*, categories(name)')
          .single();

        if (error && error.message.includes('has_drink_option')) {
          delete dbPayload.has_drink_option;
          const retryRes = await supabase
            .from('products')
            .update(dbPayload)
            .eq('id', id)
            .select('*, categories(name)')
            .single();
          data = retryRes.data;
          error = retryRes.error;
        }

        if (data && !error) {
          const updatedProd = {
            ...data,
            category_name: data.categories?.name || targetCatName || (data.is_kitchen ? 'Kitchen Meals & Cooked Food' : 'General Store Items'),
          } as Product;
          if (index !== -1) {
            products[index] = updatedProd;
            setStorage(KEYS.PRODUCTS, products);
          }
          return updatedProd;
        }
      } catch (err) {
        console.warn('Error updating product in Supabase:', err);
      }
    }

    if (index !== -1) return products[index];
    throw new Error('Product not found');
  },

  async archiveProduct(id: string): Promise<Product> {
    return this.updateProduct(id, { status: 'archived' });
  },

  async restoreProduct(id: string): Promise<Product> {
    return this.updateProduct(id, { status: 'active' });
  },

  async deleteProduct(id: string): Promise<void> {
    const products = getStorage<Product[]>(KEYS.PRODUCTS, []);
    const filtered = products.filter((p) => p.id !== id);
    setStorage(KEYS.PRODUCTS, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting product from Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'DELETE_PRODUCT',
      entity: 'PRODUCT',
      entity_id: id,
    });
  },
};
