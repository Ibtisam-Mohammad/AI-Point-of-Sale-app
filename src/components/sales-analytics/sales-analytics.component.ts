import { Component, ChangeDetectionStrategy, inject, computed, signal, effect, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { OrderService, Order } from '../../services/order.service';

// Inform TypeScript that Chart.js is loaded globally from the CDN
declare var Chart: any;

type DateRange = '7d' | '30d' | 'all';

@Component({
  selector: 'app-sales-analytics',
  templateUrl: './sales-analytics.component.html',
  imports: [CommonModule, DecimalPipe],
})
export class SalesAnalyticsComponent implements OnDestroy {
  orderService = inject(OrderService);

  @ViewChild('salesChart') salesChartCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topProductsChart') topProductsChartCanvas?: ElementRef<HTMLCanvasElement>;
  private salesChart?: any;
  private topProductsChart?: any;

  dateRange = signal<DateRange>('all');

  filteredOrders = computed(() => {
    const range = this.dateRange();
    if (range === 'all') {
      return this.orderService.orderHistory();
    }
    const days = range === '7d' ? 7 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.orderService.orderHistory().filter(order => new Date(order.timestamp) >= cutoffDate);
  });

  // --- Key Metrics ---
  totalRevenue = computed(() => this.filteredOrders().reduce((sum, order) => sum + order.grandTotal, 0));
  totalOrders = computed(() => this.filteredOrders().length);
  averageOrderValue = computed(() => {
    const total = this.totalRevenue();
    const count = this.totalOrders();
    return count > 0 ? total / count : 0;
  });

  // --- Profit Metrics ---
  totalCost = computed(() => this.filteredOrders().reduce((sum, order) => sum + order.totalCost, 0));
  totalProfit = computed(() => this.totalRevenue() - this.totalCost());
  profitMargin = computed(() => {
    const revenue = this.totalRevenue();
    return revenue > 0 ? (this.totalProfit() / revenue) * 100 : 0;
  });

  // --- Top Products ---
  topProfitProducts = computed(() => {
    const productStats = new Map<string, { quantity: number; revenue: number; profit: number }>();
    for (const order of this.filteredOrders()) {
      for (const item of order.items) {
        const stats = productStats.get(item.productName) ?? { quantity: 0, revenue: 0, profit: 0 };
        stats.quantity += item.quantity;
        stats.revenue += item.total;
        stats.profit += (item.total - item.totalCost);
        productStats.set(item.productName, stats);
      }
    }
    return Array.from(productStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.profit - a.profit);
  });
  
  topRevenueProductsForChart = computed(() => this.topProfitProducts().sort((a,b) => b.revenue - a.revenue).slice(0, 5));

  // --- Chart Data ---
  salesByDay = computed(() => {
    const salesMap = new Map<string, number>(); // Key: 'YYYY-MM-DD', Value: total sales
    for (const order of this.filteredOrders()) {
      const dateKey = order.timestamp.toISOString().split('T')[0];
      const currentSales = salesMap.get(dateKey) ?? 0;
      salesMap.set(dateKey, currentSales + order.grandTotal);
    }
    return Array.from(salesMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  });

  constructor() {
    effect(() => {
      this.updateSalesChart();
      this.updateTopProductsChart();
    });
  }

  setDateRange(range: DateRange) {
    this.dateRange.set(range);
  }

  dateRangeButtonClass(range: DateRange): string {
    const baseClass = 'px-3 py-1 text-sm font-semibold rounded-md transition-colors';
    const activeClass = 'bg-white shadow-sm text-blue-600';
    const inactiveClass = 'text-slate-600 hover:bg-white/50';
    return `${baseClass} ${this.dateRange() === range ? activeClass : inactiveClass}`;
  }

  private updateSalesChart() {
    const canvas = this.salesChartCanvas?.nativeElement;
    if (!canvas) return;

    const salesData = this.salesByDay();
    const labels = salesData.map(d => new Date(d[0]).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' }));
    const data = salesData.map(d => d[1]);

    if (this.salesChart) {
      this.salesChart.data.labels = labels;
      this.salesChart.data.datasets[0].data = data;
      this.salesChart.update('none');
    } else {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        this.createSalesChart(ctx, labels, data);
      }
    }
  }
  
  private updateTopProductsChart() {
      const canvas = this.topProductsChartCanvas?.nativeElement;
      if (!canvas) return;

      const productsData = this.topRevenueProductsForChart();
      const labels = productsData.map(p => p.name);
      const data = productsData.map(p => p.revenue);

      if (this.topProductsChart) {
          this.topProductsChart.data.labels = labels;
          this.topProductsChart.data.datasets[0].data = data;
          this.topProductsChart.update('none');
      } else {
          const ctx = canvas.getContext('2d');
          if (ctx) {
              this.createTopProductsChart(ctx, labels, data);
          }
      }
  }

  private createSalesChart(ctx: CanvasRenderingContext2D, labels: string[], data: number[]) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    this.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Revenue', data: data, fill: true, backgroundColor: gradient,
          borderColor: 'rgba(37, 99, 235, 1)', tension: 0.3, pointBackgroundColor: 'rgba(37, 99, 235, 1)',
          pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff', pointHoverBorderColor: 'rgba(37, 99, 235, 1)',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: (value: number) => '$' + value.toFixed(2) } } },
        plugins: { legend: { display: false } },
      },
    });
  }
  
  private createTopProductsChart(ctx: CanvasRenderingContext2D, labels: string[], data: number[]) {
    this.topProductsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: data,
                backgroundColor: ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899'],
                hoverOffset: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

  ngOnDestroy() {
    this.salesChart?.destroy();
    this.topProductsChart?.destroy();
  }
}