import { Component, ChangeDetectionStrategy, signal, computed, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from '../../services/gemini.service';
import { InventoryService, Product, ProductVariant } from '../../services/inventory.service';
import { OrderService, OrderItem } from '../../services/order.service';
import { PosStateService, Ambiguity } from '../../services/pos-state.service';
import { ToastService } from '../../services/toast.service';
// FIX: Removed NotFoundException as it's not exported by this module. The error will be checked by its name property instead.
import { BrowserMultiFormatReader } from '@zxing/browser';

type RecordingState = 'idle' | 'recording' | 'processing' | 'finished' | 'error';

@Component({
  selector: 'app-order-processor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-processor.component.html',
  imports: [CommonModule],
})
export class OrderProcessorComponent {
  private geminiService = inject(GeminiService);
  private inventoryService = inject(InventoryService);
  private orderService = inject(OrderService);
  private posStateService = inject(PosStateService);
  private toastService = inject(ToastService);

  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  private codeReader = new BrowserMultiFormatReader();

  state = signal<RecordingState>('idle');
  errorMessage = signal('');

  // Use signals from the service to persist state
  currentOrder = this.posStateService.currentOrder;
  customerName = this.posStateService.customerName;
  notes = this.posStateService.notes;
  unrecognizedItems = this.posStateService.unrecognizedItems;
  ambiguousItems = this.posStateService.ambiguousItems;
  lastTranscript = this.posStateService.lastTranscript;
  grandTotal = this.posStateService.grandTotal;

  // Local UI state
  isScanning = signal(false);
  isPaymentModalOpen = signal(false);
  
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  frequentlyOrderedItems = computed(() => {
    const stats = new Map<number, { orderItem: OrderItem, quantity: number }>();
    for (const order of this.orderService.orderHistory()) {
      for (const item of order.items) {
        const existing = stats.get(item.variantId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          stats.set(item.variantId, { orderItem: item, quantity: item.quantity });
        }
      }
    }
    return Array.from(stats.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .map(s => s.orderItem);
  });

  stockErrorMessage = computed(() => {
    const issues = this.inventoryService.checkStockAvailability(this.currentOrder());
    if (issues.length === 0) return '';
    const issueStrings = issues.map(i => `${i.name} (requested ${i.requested}, available ${i.available})`);
    return `Insufficient stock for: ${issueStrings.join(', ')}.`;
  });

  finalizeButtonClass = computed(() => {
    const baseClass = 'px-8 py-3 font-bold rounded-lg shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    if (this.currentOrder().length === 0 || this.ambiguousItems().length > 0) {
      return `${baseClass} bg-gray-300 text-gray-500 cursor-not-allowed`;
    }
    return `${baseClass} bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500`;
  });
  
  finalizeButtonTitle = computed(() => {
    if (this.currentOrder().length === 0) {
        return 'Add items to the order to finalize.';
    }
    if (this.ambiguousItems().length > 0) {
        return 'Please resolve all ambiguous items before finalizing.';
    }
    return 'Finalize and record transaction';
  });

  clearButtonClass = computed(() => {
    const baseClass = 'px-8 py-3 font-bold rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    if (this.currentOrder().length === 0) {
      return `${baseClass} bg-transparent border border-slate-200 text-slate-400 cursor-not-allowed`;
    }
    return `${baseClass} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-400`;
  });

  async startRecording() {
    this.unrecognizedItems.set([]);
    this.ambiguousItems.set([]);
    this.lastTranscript.set('');
    this.errorMessage.set('');
    this.state.set('recording');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = reader.result?.toString().split(',')[1];
          if (base64String) {
            this.processAudio(base64String, audioBlob.type);
          } else {
            this.state.set('error');
            this.errorMessage.set('Could not process audio data.');
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      this.mediaRecorder.start();
    } catch (err) {
      console.error('Error starting recording:', err);
      this.state.set('error');
      this.errorMessage.set('Could not access microphone. Please ensure permissions are granted.');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.state() === 'recording') {
      this.mediaRecorder.stop();
      this.state.set('processing');
    }
  }
  
  async processAudio(audioBase64: string, mimeType: string) {
    try {
      this.state.set('processing');
      const inventory = this.inventoryService.products();
      const result = await this.geminiService.processVoiceOrder(audioBase64, mimeType, inventory, this.currentOrder());
      
      this.lastTranscript.set(result.transcript);
      this.unrecognizedItems.set(result.unrecognizedItems);

      const ambiguities: Ambiguity[] = [];
      this.currentOrder.set([]);

      for (const item of result.items) {
        const product = this.inventoryService.findProductByFuzzyName(item.productName);
        if (!product) {
          this.unrecognizedItems.update(current => [...current, `${item.productName} ${item.variantName || ''}`.trim()]);
          continue;
        }

        if (item.variantName) {
          const variant = this.inventoryService.findVariant(product, item.variantName);
          if (variant) {
            this.posStateService.addItemToOrder(product, variant, item.quantity);
          } else {
             this.unrecognizedItems.update(current => [...current, `${item.productName} (${item.variantName})`]);
          }
        } else {
          if (product.variants.length === 1) {
            this.posStateService.addItemToOrder(product, product.variants[0], item.quantity);
          } else {
            ambiguities.push({ term: product.name, product, quantity: item.quantity });
          }
        }
      }

      this.ambiguousItems.set(ambiguities);
      this.state.set('finished');

    } catch (err) {
      console.error('Error processing audio:', err);
      this.state.set('error');
      this.errorMessage.set(err instanceof Error ? err.message : 'An unknown error occurred.');
    }
  }

  addItemByBarcode(barcode: string) {
    if (!barcode) return;
    const item = this.inventoryService.findItemByBarcode(barcode);
    if (item) {
      this.posStateService.addItemToOrder(item.product, item.variant, 1);
      this.toastService.showSuccess(`${item.product.name} added.`);
      this.state.set('finished');
    } else {
      this.toastService.showError('Barcode not found in inventory.');
    }
  }

  async startScanner() {
    this.isScanning.set(true);
    try {
      // Timeout to allow the view to update and the video element to be available
      await new Promise(resolve => setTimeout(resolve, 0)); 
      if (!this.videoElement) {
        throw new Error('Video element not found');
      }
      this.codeReader.decodeFromVideoDevice(undefined, this.videoElement.nativeElement, (result, err: any) => {
        if (result) {
          this.addItemByBarcode(result.getText());
          this.stopScanner();
        }
        // FIX: Check for NotFoundException by its name property, as the type is not exported.
        if (err && err.name !== 'NotFoundException') {
          console.error(err);
          this.toastService.showError('Error while scanning.');
          this.stopScanner();
        }
      });
    } catch (error) {
      console.error('Error starting scanner:', error);
      this.toastService.showError('Could not start camera. Check permissions.');
      this.isScanning.set(false);
    }
  }

  stopScanner() {
    // FIX: The 'reset()' method is the correct way to stop the camera stream and reset the reader state.
    // Casting to 'any' to bypass a potential typings issue where the method is not found on the BrowserMultiFormatReader type.
    (this.codeReader as any).reset();
    this.isScanning.set(false);
  }

  quickAddItem(item: OrderItem) {
    const product = this.inventoryService.getProductById(item.productId);
    const variant = this.inventoryService.getVariantById(item.productId, item.variantId);
    if (product && variant) {
      this.posStateService.addItemToOrder(product, variant, 1);
      this.toastService.showSuccess(`${item.name} added.`);
    }
  }
  
  updateQuantity(variantId: number, newQuantity: number) {
    this.posStateService.updateQuantity(variantId, newQuantity);
  }
  
  updateQuantityFromInput(event: Event, variantId: number) {
    const input = event.target as HTMLInputElement;
    const quantity = parseInt(input.value, 10);
    if (!isNaN(quantity)) {
      this.posStateService.updateQuantity(variantId, quantity);
    }
  }
  
  onCustomerNameInput(event: Event) {
    this.customerName.set((event.target as HTMLInputElement).value);
  }

  onNotesInput(event: Event) {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  resolveAmbiguity(term: string, chosenVariant: ProductVariant) {
    const ambiguity = this.ambiguousItems().find(a => a.term === term);
    if (!ambiguity) return;
    this.posStateService.resolveAmbiguity(term, ambiguity.product, chosenVariant, ambiguity.quantity);
  }

  dismissAmbiguity(term: string) {
    this.posStateService.dismissAmbiguity(term);
  }

  openPaymentModal() {
    if (this.currentOrder().length === 0 || this.ambiguousItems().length > 0 || this.stockErrorMessage()) {
        this.toastService.showError("Cannot finalize order. Check for errors.");
        return;
    }
    this.isPaymentModalOpen.set(true);
  }
  
  confirmPayment() {
    const stockUpdates = this.currentOrder().map(item => ({ variantId: item.variantId, quantity: item.quantity }));
    this.inventoryService.updateStock(stockUpdates);

    this.orderService.addOrderToHistory(
        this.currentOrder(), 
        this.grandTotal(), 
        this.lastTranscript(),
        this.customerName(),
        this.notes()
    );
    
    this.toastService.showSuccess(`Order #${this.orderService.orderHistory()[0].id} finalized.`);
    this.isPaymentModalOpen.set(false);
    this.clearAndResetUi();
  }

  clearAndResetUi() {
    this.posStateService.clearOrderState();
    this.state.set('idle');
    this.errorMessage.set('');
  }
}
