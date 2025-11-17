import { Injectable, signal, inject } from '@angular/core';
import { Customer, CustomerService } from './customer.service';

export interface OrderItem {
  productId: number;
  variantId: number;
  productName: string;
  variantName: string;
  name: string; // Composite name: "Classic Cola (Small)"
  quantity: number;
  price: number;
  cost: number;
  total: number;
  totalCost: number;
  stock?: number;
}


export interface Order {
  id: number;
  timestamp: Date;
  items: OrderItem[];
  grandTotal: number;
  totalCost: number;
  profit: number;
  transcript: string;
  customerId?: number;
  customerName?: string;
  notes?: string;
}


@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private customerService = inject(CustomerService);
  private nextId = signal(1);
  orderHistory = signal<Order[]>([]);

  addOrderToHistory(items: OrderItem[], grandTotal: number, transcript: string, customerName?: string, notes?: string) {
    let customer: Customer | undefined;
    if (customerName && customerName.trim()) {
      customer = this.customerService.findOrCreateCustomer(customerName);
      this.customerService.updateCustomerStats(customer.id, grandTotal);
    }
    
    const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
    const profit = grandTotal - totalCost;

    const newOrder: Order = {
      id: this.nextId(),
      timestamp: new Date(),
      items,
      grandTotal,
      totalCost,
      profit,
      transcript,
      ...(customer && { customerId: customer.id, customerName: customer.name }),
      ...(notes && { notes })
    };
    this.orderHistory.update(history => [newOrder, ...history]);
    this.nextId.update(id => id + 1);
  }
}
