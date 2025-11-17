import { Injectable, signal } from '@angular/core';

export interface ProductVariant {
  id: number;
  name: string; // e.g., "Small", "12oz", "Regular"
  price: number;
  cost: number;
  stock: number;
  barcode?: string;
}

export interface Product {
  id: number;
  name:string; // e.g., "Classic Cola"
  variants: ProductVariant[];
  lastUpdated: Date;
}


export interface StockIssue {
  name: string; // Full name like "Classic Cola (Small)"
  requested: number;
  available: number;
}

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private nextProductId = signal(4);
  private nextVariantId = signal(100);
  
  products = signal<Product[]>([
    { 
      id: 1, name: 'Classic Cola', lastUpdated: new Date(),
      variants: [
        { id: 10, name: 'Small', price: 1.50, cost: 0.50, stock: 100, barcode: '123456789012' },
        { id: 11, name: 'Medium', price: 2.00, cost: 0.70, stock: 80, barcode: '123456789013' },
        { id: 12, name: 'Large', price: 2.50, cost: 0.90, stock: 60, barcode: '123456789014' },
      ] 
    },
    { 
      id: 2, name: 'Potato Chips', lastUpdated: new Date(),
      variants: [
        { id: 13, name: 'Regular', price: 2.25, cost: 0.85, stock: 80, barcode: '234567890123' }
      ]
    },
    {
      id: 3, name: 'Chocolate Bar', lastUpdated: new Date(),
      variants: [
        { id: 14, name: 'Standard', price: 1.75, cost: 0.60, stock: 120, barcode: '345678901234' }
      ]
    }
  ]);

  // Methods to find products/variants
  getProductById(productId: number): Product | undefined {
    return this.products().find(p => p.id === productId);
  }

  getVariantById(productId: number, variantId: number): ProductVariant | undefined {
    const product = this.getProductById(productId);
    return product?.variants.find(v => v.id === variantId);
  }

  findProductByFuzzyName(name: string): Product | undefined {
    const lowerCaseName = name.toLowerCase().trim();
    return this.products().find(p => p.name.toLowerCase().includes(lowerCaseName));
  }

  findVariant(product: Product, variantName: string): ProductVariant | undefined {
      const lowerVariantName = variantName.toLowerCase().trim();
      // Prioritize exact match
      let variant = product.variants.find(v => v.name.toLowerCase() === lowerVariantName);
      if (variant) return variant;
      // Fallback to partial match
      variant = product.variants.find(v => v.name.toLowerCase().includes(lowerVariantName));
      return variant;
  }
  
  findItemByBarcode(barcode: string): { product: Product, variant: ProductVariant } | undefined {
    for (const product of this.products()) {
        const variant = product.variants.find(v => v.barcode === barcode);
        if (variant) {
            return { product, variant };
        }
    }
    return undefined;
  }
  
  // CRUD methods
  addProduct(productData: { name: string }) {
    const id = this.nextProductId();
    const newProduct: Product = {
        id,
        name: productData.name,
        variants: [],
        lastUpdated: new Date()
    };
    this.products.update(products => [...products, newProduct]);
    this.nextProductId.update(id => id + 1);
    return newProduct;
  }
  
  updateProduct(productId: number, productData: { name: string }) {
    this.products.update(products => products.map(p => 
      p.id === productId ? { ...p, name: productData.name, lastUpdated: new Date() } : p
    ));
  }

  deleteProduct(productId: number) {
    this.products.update(products => products.filter(p => p.id !== productId));
  }
  
  addVariant(productId: number, variantData: Omit<ProductVariant, 'id'>) {
    const id = this.nextVariantId();
    this.products.update(products => products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          variants: [...p.variants, { id, ...variantData }],
          lastUpdated: new Date()
        };
      }
      return p;
    }));
    this.nextVariantId.update(id => id + 1);
  }

  updateVariant(productId: number, variantData: ProductVariant) {
    this.products.update(products => products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          variants: p.variants.map(v => v.id === variantData.id ? variantData : v),
          lastUpdated: new Date()
        };
      }
      return p;
    }));
  }

  deleteVariant(productId: number, variantId: number) {
    this.products.update(products => products.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          variants: p.variants.filter(v => v.id !== variantId),
          lastUpdated: new Date()
        };
      }
      return p;
    }));
  }
  
  checkStockAvailability(orderItems: { name: string; quantity: number, stock?: number }[]): StockIssue[] {
    const issues: StockIssue[] = [];
    for (const orderItem of orderItems) {
        if (orderItem.stock != null && orderItem.stock < orderItem.quantity) {
            issues.push({
                name: orderItem.name,
                requested: orderItem.quantity,
                available: orderItem.stock,
            });
        }
    }
    return issues;
  }

  updateStock(updates: { variantId: number; quantity: number }[]) {
    this.products.update(products => {
      const newProducts = JSON.parse(JSON.stringify(products)); // Deep copy to handle immutable signals
      for (const p of newProducts) {
        for (const v of p.variants) {
          const update = updates.find(u => u.variantId === v.id);
          if (update) {
            v.stock -= update.quantity;
            p.lastUpdated = new Date().toISOString();
          }
        }
      }
      return newProducts.map((p: Product) => ({ ...p, lastUpdated: new Date(p.lastUpdated) }));
    });
  }

  addStockToItems(stockUpdates: { variantId: number, quantity: number }[]) {
    this.products.update(currentItems => {
      const newItems = JSON.parse(JSON.stringify(currentItems));
      stockUpdates.forEach(update => {
          for(const p of newItems) {
              const variant = p.variants.find((v: ProductVariant) => v.id === update.variantId);
              if (variant) {
                  variant.stock += update.quantity;
                  p.lastUpdated = new Date().toISOString();
              }
          }
      });
      return newItems.map((p: Product) => ({ ...p, lastUpdated: new Date(p.lastUpdated) }));
    });
  }
}
