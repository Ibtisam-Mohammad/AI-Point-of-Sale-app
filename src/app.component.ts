import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OrderProcessorComponent } from './components/order-processor/order-processor.component';
import { InventoryManagerComponent } from './components/inventory-manager/inventory-manager.component';
import { OrderHistoryComponent } from './components/order-history/order-history.component';
import { SalesAnalyticsComponent } from './components/sales-analytics/sales-analytics.component';
import { CustomerManagementComponent } from './components/customer-management/customer-management.component';

type Tab = 'pos' | 'inventory' | 'history' | 'analytics' | 'customers';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    OrderProcessorComponent,
    InventoryManagerComponent,
    OrderHistoryComponent,
    SalesAnalyticsComponent,
    CustomerManagementComponent,
  ],
  template: `
    <div class="min-h-screen bg-slate-100 font-sans">
      <header class="bg-white/80 backdrop-blur-lg sticky top-0 z-40 shadow-sm">
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center py-3">
            <h1 class="text-2xl font-bold text-slate-800 flex items-center">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7 mr-2 text-blue-600">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 1.5m1-1.5l1 1.5m0 0l.5 1.5m-1.5-1.5l-1.5-1.5m0 0l1.5 1.5m-4.5-3l2-3m2 3l2-3m0 0l-2 3m-2-3l-2 3m6 3H9m12-3.75A2.25 2.25 0 0018.75 9H5.25A2.25 2.25 0 003 11.25m15.75 0v-1.5" />
              </svg>
              <span class="mt-0.5">VentiPOS</span>
            </h1>
            <nav>
              <ul class="flex items-center space-x-2">
                <li><button (click)="selectTab('pos')" [class]="tabButtonClass('pos')">Point of Sale</button></li>
                <li><button (click)="selectTab('inventory')" [class]="tabButtonClass('inventory')">Inventory</button></li>
                <li><button (click)="selectTab('history')" [class]="tabButtonClass('history')">Order History</button></li>
                <li><button (click)="selectTab('analytics')" [class]="tabButtonClass('analytics')">Analytics</button></li>
                <li><button (click)="selectTab('customers')" [class]="tabButtonClass('customers')">Customers</button></li>
              </ul>
            </nav>
          </div>
        </div>
      </header>

      <main class="container mx-auto p-4 sm:p-6 lg:p-10">
        @switch (activeTab()) {
          @case ('pos') {
            <app-order-processor />
          }
          @case ('inventory') {
            <app-inventory-manager />
          }
          @case ('history') {
            <app-order-history />
          }
          @case ('analytics') {
            <app-sales-analytics />
          }
          @case ('customers') {
            <app-customer-management />
          }
        }
      </main>
      
      <footer class="text-center py-8 text-slate-500 text-sm">
        <p>Powered by Angular and Google Gemini</p>
      </footer>
    </div>
  `,
})
export class AppComponent {
  activeTab = signal<Tab>('pos');

  selectTab(tab: Tab) {
    this.activeTab.set(tab);
  }

  tabButtonClass(tab: Tab): string {
    const baseClass = 'font-semibold text-sm transition-colors duration-200 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500';
    
    if (this.activeTab() === tab) {
      return `${baseClass} bg-blue-600 text-white shadow-sm`;
    }
    return `${baseClass} text-slate-600 hover:bg-blue-100 hover:text-blue-700`;
  }
}