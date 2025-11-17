import { Injectable, signal, computed } from '@angular/core';
import { OrderItem } from './order.service';
import { Product, ProductVariant } from './inventory.service';

export type Ambiguity = { 
  term: string; 
  product: Product;
  quantity: number 
};

@Injectable({
  providedIn: 'root',
})
export class PosStateService {
  currentOrder = signal<OrderItem[]>([]);
  customerName = signal('');
  notes = signal('');
  unrecognizedItems = signal<string[]>([]);
  ambiguousItems = signal<Ambiguity[]>([]);
  lastTranscript = signal('');

  grandTotal = computed(() => this.currentOrder().reduce((sum, item) => sum + item.total, 0));

  addItemToOrder(product: Product, variant: ProductVariant, quantity: number) {
    this.currentOrder.update(order => {
      const existingItem = order.find(i => i.variantId === variant.id);
      if (existingItem) {
        return order.map(i => i.variantId === variant.id ? { 
            ...i, 
            quantity: i.quantity + quantity, 
            total: (i.quantity + quantity) * i.price,
            totalCost: (i.quantity + quantity) * i.cost,
        } : i);
      }
      return [...order, { 
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        variantName: variant.name,
        name: `${product.name} (${variant.name})`, 
        quantity, 
        price: variant.price,
        cost: variant.cost, 
        total: variant.price * quantity,
        totalCost: variant.cost * quantity,
        stock: variant.stock
      }];
    });
  }

  updateQuantity(variantId: number, newQuantity: number) {
     this.currentOrder.update(order => {
       if (newQuantity <= 0) {
          return order.filter(item => item.variantId !== variantId);
       }
       return order.map(item => {
          if (item.variantId === variantId) {
            return {
              ...item,
              quantity: newQuantity,
              total: newQuantity * item.price,
              totalCost: newQuantity * item.cost,
            };
          }
          return item;
       });
    });
  }

  resolveAmbiguity(term: string, product: Product, chosenVariant: ProductVariant, quantity: number) {
    this.addItemToOrder(product, chosenVariant, quantity);
    this.dismissAmbiguity(term);
  }

  dismissAmbiguity(term: string) {
    this.ambiguousItems.update(ambiguities => ambiguities.filter(a => a.term !== term));
  }

  clearOrderState() {
    this.currentOrder.set([]);
    this.unrecognizedItems.set([]);
    this.ambiguousItems.set([]);
    this.lastTranscript.set('');
    this.customerName.set('');
    this.notes.set('');
  }
}
