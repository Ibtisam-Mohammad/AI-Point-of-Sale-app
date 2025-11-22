import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed bottom-5 right-5 z-[100] space-y-3">
      @for (toast of toasts(); track toast.id) {
        <div 
          [class]="toastClasses(toast.type)"
          role="alert">
          
          <div class="flex-shrink-0" [innerHTML]="toastIcon(toast.type)"></div>

          <div class="flex-1">
            <p [class]="'font-semibold ' + toastTextColor(toast.type)">{{ toastTitle(toast.type) }}</p>
            <p [class]="'text-sm ' + toastMessageColor(toast.type)">{{ toast.message }}</p>
          </div>

          <button (click)="toastService.remove(toast.id)" class="p-1 rounded-full hover:bg-black/10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" [attr.class]="'h-5 w-5 ' + toastMessageColor(toast.type)" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .slide-in {
      animation: slideIn 0.3s ease-out forwards;
    }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
  toasts = this.toastService.toasts;

  toastClasses(type: Toast['type']): string {
    const baseClasses = 'slide-in relative w-full max-w-sm rounded-lg shadow-lg p-4 flex items-start space-x-3 pointer-events-auto';
    switch (type) {
      case 'success': return `${baseClasses} bg-emerald-50 border border-emerald-200`;
      case 'error': return `${baseClasses} bg-red-50 border border-red-200`;
      case 'info': return `${baseClasses} bg-blue-50 border border-blue-200`;
    }
  }

  toastTextColor(type: Toast['type']): string {
     switch (type) {
      case 'success': return 'text-emerald-800';
      case 'error': return 'text-red-800';
      case 'info': return 'text-blue-800';
    }
  }
  
  toastMessageColor(type: Toast['type']): string {
     switch (type) {
      case 'success': return 'text-emerald-700';
      case 'error': return 'text-red-700';
      case 'info': return 'text-blue-700';
    }
  }

  toastTitle(type: Toast['type']): string {
     switch (type) {
      case 'success': return 'Success';
      case 'error': return 'Error';
      case 'info': return 'Information';
    }
  }

  toastIcon(type: Toast['type']): string {
    switch (type) {
      case 'success':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>`;
      case 'error':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>`;
      case 'info':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>`;
    }
  }
}
