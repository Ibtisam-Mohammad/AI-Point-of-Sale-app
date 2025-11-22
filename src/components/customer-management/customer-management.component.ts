import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { CustomerService, Customer } from '../../services/customer.service';
import { OrderService, Order } from '../../services/order.service';

@Component({
  selector: 'app-customer-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, CommonModule],
  template: `
    <div class="bg-white p-8 rounded-xl shadow-md border border-slate-200">
      <div class="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Customer Management</h2>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search by name or ID..."
            (input)="onSearch($event)"
            class="w-full max-w-md pl-10 pr-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white">
          <thead class="bg-slate-50">
            <tr>
              <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
              <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Orders</th>
              <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Spent</th>
              <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Seen</th>
            </tr>
          </thead>
          <tbody class="text-gray-700 divide-y divide-slate-200">
            @for (customer of filteredCustomers(); track customer.id; let isOdd = $odd) {
              <tr (click)="viewCustomerDetails(customer)" class="hover:bg-slate-100 cursor-pointer" [class.bg-slate-50]="isOdd">
                <td class="py-3 px-4">{{ customer.id }}</td>
                <td class="py-3 px-4 font-medium">{{ customer.name }}</td>
                <td class="py-3 px-4">{{ customer.totalOrders }}</td>
                <td class="py-3 px-4">{{ customer.totalSpent | currency }}</td>
                <td class="py-3 px-4">{{ customer.lastSeen | date:'short' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="text-center py-10 text-gray-500">
                   <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.78-4.125M15 15v6M18 8a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                   <p class="mt-2">No customers found.</p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Customer Detail Modal -->
    @if (isDetailModalOpen() && selectedCustomer(); as customer) {
      <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all">
          <div class="flex justify-between items-center pb-3 border-b border-slate-200">
            <h3 class="text-xl font-semibold">{{ customer.name }}</h3>
            <button (click)="isDetailModalOpen.set(false)" class="text-slate-400 hover:text-slate-600">&times;</button>
          </div>
          <div class="mt-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded-lg">
              <div>
                <p class="text-sm text-slate-500">Total Orders</p>
                <p class="font-bold text-lg text-slate-800">{{ customer.totalOrders }}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">Total Spent</p>
                <p class="font-bold text-lg text-slate-800">{{ customer.totalSpent | currency }}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">First Seen</p>
                <p class="font-bold text-lg text-slate-800">{{ customer.firstSeen | date:'shortDate' }}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">Last Seen</p>
                <p class="font-bold text-lg text-slate-800">{{ customer.lastSeen | date:'shortDate' }}</p>
              </div>
            </div>
            <h4 class="text-lg font-semibold mb-2">Order History</h4>
            <div class="max-h-80 overflow-y-auto border rounded-lg">
              <table class="min-w-full">
                <thead class="bg-slate-50 sticky top-0">
                  <tr>
                    <th class="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase">Order ID</th>
                    <th class="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th class="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                    <th class="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  @for (order of selectedCustomerOrders(); track order.id) {
                    <tr class="hover:bg-slate-50">
                      <td class="py-2 px-3 text-sm">{{ order.id }}</td>
                      <td class="py-2 px-3 text-sm">{{ order.timestamp | date:'short' }}</td>
                      <td class="py-2 px-3 text-sm">{{ order.items.length }}</td>
                      <td class="py-2 px-3 text-right font-medium text-sm">{{ order.grandTotal | currency }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="text-center p-6 text-slate-500">No orders for this customer.</td></tr>
                  }
                </tbody>
              </table>
            </div>
             <div class="flex justify-end mt-6">
                <button (click)="isDetailModalOpen.set(false)" class="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">Close</button>
             </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class CustomerManagementComponent {
  customerService = inject(CustomerService);
  orderService = inject(OrderService);
  searchTerm = signal('');
  
  selectedCustomer = signal<Customer | null>(null);
  isDetailModalOpen = signal(false);

  filteredCustomers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      return this.customerService.customers();
    }
    return this.customerService.customers().filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      customer.id.toString().includes(term)
    );
  });

  selectedCustomerOrders = computed(() => {
      const customer = this.selectedCustomer();
      if (!customer) return [];
      return this.orderService.orderHistory().filter(o => o.customerId === customer.id);
  });

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  viewCustomerDetails(customer: Customer) {
    this.selectedCustomer.set(customer);
    this.isDetailModalOpen.set(true);
  }
}