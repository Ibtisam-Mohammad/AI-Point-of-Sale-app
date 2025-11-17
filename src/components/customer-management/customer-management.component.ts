import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { CustomerService } from '../../services/customer.service';

@Component({
  selector: 'app-customer-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe],
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
              <tr class="hover:bg-slate-100" [class.bg-slate-50]="isOdd">
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
  `,
})
export class CustomerManagementComponent {
  customerService = inject(CustomerService);
  searchTerm = signal('');

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

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}