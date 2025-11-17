import { Component, ChangeDetectionStrategy, inject, computed, signal, effect, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { OrderService } from '../../services/order.service';

// Inform TypeScript that Chart.js is loaded globally from the CDN
declare var Chart: any;

@Component({
  selector: 'app-sales-analytics',
  templateUrl: './sales-analytics.component.html',
  imports: [CommonModule, DecimalPipe],
})
export class SalesAnalyticsComponent implements OnDestroy {
  orderService = inject(OrderService);

  @ViewChild('salesChart') salesChartCanvas?: ElementRef<HTMLCanvasElement>;
  private chart?: any; // To hold the Chart.js instance

  // --- Key Metrics ---
  totalRevenue = computed(() => this.orderService.orderHistory().reduce((sum, order) => sum + order.grandTotal, 0));
  totalOrders = computed(() => this.orderService.orderHistory().length);
  averageOrderValue = computed(() => {
    const total = this.totalRevenue();
    const count = this.totalOrders();
    return count > 0 ? total / count : 0;
  });

  // --- Profit Metrics ---
  totalCost = computed(() => this.orderService.orderHistory().reduce((sum, order) => sum + order.totalCost, 0));
  totalProfit = computed(() => this.totalRevenue() - this.totalCost());
  profitMargin = computed(() => {
    const revenue = this.totalRevenue();
    return revenue > 0 ? (this.totalProfit() / revenue) * 100 : 0;
  });

  // --- Top Products by Profit ---
  topProfitProducts = computed(() => {
    const productStats = new Map<string, { quantity: number; revenue: number; profit: number }>();
    for (const order of this.orderService.orderHistory()) {
      for (const item of order.items) {
        // We group by base product name
        const stats = productStats.get(item.productName) ?? { quantity: 0, revenue: 0, profit: 0 };
        stats.quantity += item.quantity;
        stats.revenue += item.total;
        stats.profit += (item.total - item.totalCost);
        productStats.set(item.productName, stats);
      }
    }
    return Array.from(productStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  });

  // --- Chart Data ---
  salesByDay = computed(() => {
    const salesMap = new Map<string, number>(); // Key: 'YYYY-MM-DD', Value: total sales
    for (const order of this.orderService.orderHistory()) {
      const dateKey = order.timestamp.toISOString().split('T')[0];
      const currentSales = salesMap.get(dateKey) ?? 0;
      salesMap.set(dateKey, currentSales + order.grandTotal);
    }
    return Array.from(salesMap.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  });

  constructor() {
    effect(() => {
      const canvas = this.salesChartCanvas?.nativeElement;
      if (!canvas) return;

      const salesData = this.salesByDay();
      const labels = salesData.map(d => new Date(d[0]).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' }));
      const data = salesData.map(d => d[1]);

      if (this.chart) {
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update('none');
      } else {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          this.createChart(ctx, labels, data);
        }
      }
    });
  }

  private createChart(ctx: CanvasRenderingContext2D, labels: string[], data: number[]) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Daily Revenue',
            data: data,
            fill: true,
            backgroundColor: gradient,
            borderColor: 'rgba(37, 99, 235, 1)',
            tension: 0.3,
            pointBackgroundColor: 'rgba(37, 99, 235, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(37, 99, 235, 1)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value: number) => '$' + value.toFixed(2),
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}