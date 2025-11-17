import { Injectable, signal } from '@angular/core';

export interface Customer {
  id: number;
  name: string;
  firstSeen: Date;
  lastSeen: Date;
  totalOrders: number;
  totalSpent: number;
}

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private nextId = signal(1);
  customers = signal<Customer[]>([]);

  findOrCreateCustomer(name: string): Customer {
    const lowerCaseName = name.trim().toLowerCase();
    
    // This is important to avoid creating empty customers
    if (!lowerCaseName) {
        throw new Error("Customer name cannot be empty.");
    }

    const existingCustomer = this.customers().find(c => c.name.toLowerCase() === lowerCaseName);

    if (existingCustomer) {
      return existingCustomer;
    }
    
    const newCustomer: Customer = {
      id: this.nextId(),
      name: name.trim(), // Store with original casing
      firstSeen: new Date(),
      lastSeen: new Date(),
      totalOrders: 0,
      totalSpent: 0,
    };
    
    this.customers.update(customers => [...customers, newCustomer]);
    this.nextId.update(id => id + 1);
    
    return newCustomer;
  }

  updateCustomerStats(customerId: number, orderTotal: number): void {
    this.customers.update(customers =>
      customers.map(customer =>
        customer.id === customerId
          ? {
              ...customer,
              totalOrders: customer.totalOrders + 1,
              totalSpent: customer.totalSpent + orderTotal,
              lastSeen: new Date(),
            }
          : customer
      )
    );
  }
}
