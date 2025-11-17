import { Component, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../services/order.service';

@Component({
  selector: 'app-order-history',
  templateUrl: './order-history.component.html',
  imports: [CommonModule],
})
export class OrderHistoryComponent {
  orderService = inject(OrderService);
  searchTerm = signal('');

  filteredOrders = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      return this.orderService.orderHistory();
    }
    return this.orderService.orderHistory().filter(order => {
      const orderIdMatch = order.id.toString().includes(term);
      const customerNameMatch = order.customerName?.toLowerCase().includes(term);
      const customerIdMatch = order.customerId?.toString().includes(term);
      return orderIdMatch || !!customerNameMatch || !!customerIdMatch;
    });
  });

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}
