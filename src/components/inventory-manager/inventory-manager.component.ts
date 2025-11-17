import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { InventoryService, Product, ProductVariant } from '../../services/inventory.service';
import { GeminiService, ParsedInventoryImageResult, ParsedVoiceProduct, ParsedVariant } from '../../services/gemini.service';

type VoiceAddState = 'idle' | 'recording' | 'processing' | 'confirming' | 'error';

@Component({
  selector: 'app-inventory-manager',
  imports: [CommonModule, ReactiveFormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventory-manager.component.html'
})
export class InventoryManagerComponent {
  inventoryService = inject(InventoryService);
  geminiService = inject(GeminiService);
  fb: FormBuilder = inject(FormBuilder);

  products = this.inventoryService.products;
  
  // State for forms and UI
  isProductFormOpen = signal(false);
  editingProduct = signal<Product | null>(null);
  productForm: FormGroup;

  isVariantFormOpen = signal(false);
  editingVariant = signal<{ product: Product, variant: ProductVariant } | null>(null);
  variantForm: FormGroup;

  // State for image processing
  isProcessingImage = signal(false);
  imageProcessingError = signal<string | null>(null);
  parsedImageResult = signal<ParsedInventoryImageResult | null>(null);

  // State for voice processing
  voiceAddState = signal<VoiceAddState>('idle');
  voiceAddError = signal<string | null>(null);
  voiceConfirmForm: FormGroup;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor() {
    this.productForm = this.fb.group({
      id: [null],
      name: ['', Validators.required],
    });

    this.variantForm = this.fb.group({
      id: [null],
      productId: [null, Validators.required],
      name: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      cost: [0, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      barcode: [''],
    });

    this.voiceConfirmForm = this.fb.group({
      productName: ['', Validators.required],
      variants: this.fb.array([])
    });
  }

  get voiceConfirmVariants(): FormArray {
    return this.voiceConfirmForm.get('variants') as FormArray;
  }

  createVariantGroup(variant: Partial<ParsedVariant> = {}): FormGroup {
    return this.fb.group({
      name: [variant.name ?? '', Validators.required],
      price: [variant.price ?? 0, [Validators.required, Validators.min(0)]],
      cost: [variant.cost ?? 0, [Validators.required, Validators.min(0)]],
      stock: [variant.stock ?? 0, [Validators.required, Validators.min(0)]]
    });
  }
  
  addVariantToConfirmForm() {
    this.voiceConfirmVariants.push(this.createVariantGroup());
  }

  removeVariantFromConfirmForm(index: number) {
    this.voiceConfirmVariants.removeAt(index);
  }

  // Product Methods
  openNewProductForm() {
    this.editingProduct.set(null);
    this.productForm.reset({ name: '' });
    this.isProductFormOpen.set(true);
  }

  openEditProductForm(product: Product) {
    this.editingProduct.set(product);
    this.productForm.reset(product);
    this.isProductFormOpen.set(true);
  }
  
  saveProduct() {
    if (this.productForm.invalid) return;
    
    const productData = this.productForm.value;
    if (this.editingProduct()) {
      this.inventoryService.updateProduct(this.editingProduct()!.id, productData);
    } else {
      const newProduct = this.inventoryService.addProduct(productData);
      // Open variant form to add the first variant
      this.openNewVariantForm(newProduct);
    }
    this.closeProductForm();
  }

  closeProductForm() {
    this.isProductFormOpen.set(false);
    this.editingProduct.set(null);
  }
  
  deleteProduct(productId: number) {
    if (confirm('Are you sure you want to delete this product and all its variants?')) {
        this.inventoryService.deleteProduct(productId);
    }
  }

  // Variant Methods
  openNewVariantForm(product: Product) {
    this.editingVariant.set(null);
    this.variantForm.reset({ productId: product.id, name: 'Standard', price: 0, cost: 0, stock: 0, barcode: '' });
    this.isVariantFormOpen.set(true);
  }
  
  openEditVariantForm(product: Product, variant: ProductVariant) {
    this.editingVariant.set({ product, variant });
    this.variantForm.reset({ ...variant, productId: product.id });
    this.isVariantFormOpen.set(true);
  }

  saveVariant() {
    if (this.variantForm.invalid) return;
    
    const variantData = this.variantForm.value;
    const productId = variantData.productId;
    delete variantData.productId;

    if (this.editingVariant()) {
      this.inventoryService.updateVariant(productId, variantData);
    } else {
      this.inventoryService.addVariant(productId, variantData);
    }
    this.closeVariantForm();
  }

  closeVariantForm() {
    this.isVariantFormOpen.set(false);
    this.editingVariant.set(null);
  }

  deleteVariant(productId: number, variantId: number) {
    if (confirm('Are you sure you want to delete this variant?')) {
        this.inventoryService.deleteVariant(productId, variantId);
    }
  }

  // Image Parsing Methods
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isProcessingImage.set(true);
    this.imageProcessingError.set(null);
    this.parsedImageResult.set(null);

    try {
      const base64String = await this.fileToBase64(file);
      const result = await this.geminiService.parseInventoryImage(base64String, file.type, this.products());
      this.parsedImageResult.set(result);
    } catch (error) {
      console.error('Error processing image:', error);
      this.imageProcessingError.set(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
      this.isProcessingImage.set(false);
      if (input) {
        input.value = ''; 
      }
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  }

  addRecognizedItemsToStock() {
    const result = this.parsedImageResult();
    if (!result || result.recognizedItems.length === 0) return;

    const stockUpdates = result.recognizedItems
      .filter(item => item.variantId !== undefined)
      .map(item => ({ variantId: item.variantId!, quantity: item.quantity }));
      
    if (stockUpdates.length > 0) {
        this.inventoryService.addStockToItems(stockUpdates);
        alert(`${stockUpdates.length} item types added to stock.`);
    }
    this.parsedImageResult.set(null);
  }

  addNewProductFromUnrecognized(item: { itemName: string, quantity: number, price?: number }) {
    const newProduct = this.inventoryService.addProduct({ name: item.itemName });
    this.inventoryService.addVariant(newProduct.id, {
        name: 'Standard',
        price: item.price ?? 0,
        cost: 0,
        stock: item.quantity
    });
    this.parsedImageResult.update(res => {
        if (!res) return null;
        return {
            ...res,
            unrecognizedItems: res.unrecognizedItems.filter(ui => ui.itemName !== item.itemName)
        };
    });
  }

  dismissImageResults() {
    this.parsedImageResult.set(null);
  }

  // Voice Add Methods
  async startVoiceAdd() {
    this.voiceAddState.set('recording');
    this.voiceAddError.set(null);
    
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
            this.processVoiceProductAudio(base64String, audioBlob.type);
          } else {
            this.voiceAddState.set('error');
            this.voiceAddError.set('Could not process audio data.');
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      this.mediaRecorder.start();
    } catch (err) {
      console.error('Error starting recording:', err);
      this.voiceAddState.set('error');
      this.voiceAddError.set('Could not access microphone. Please ensure permissions are granted.');
    }
  }
  
  stopVoiceAdd() {
    if (this.mediaRecorder && this.voiceAddState() === 'recording') {
      this.mediaRecorder.stop();
      this.voiceAddState.set('processing');
    }
  }
  
  async processVoiceProductAudio(audioBase64: string, mimeType: string) {
    try {
      this.voiceAddState.set('processing');
      const result = await this.geminiService.processVoiceInventoryAdd(audioBase64, mimeType);
      
      if (result && result.productName && result.variants.length > 0) {
        this.voiceConfirmForm.patchValue({ productName: result.productName });
        this.voiceConfirmVariants.clear();
        result.variants.forEach(variant => {
            this.voiceConfirmVariants.push(this.createVariantGroup(variant));
        });
        this.voiceAddState.set('confirming');
      } else {
        throw new Error("Could not identify a valid product and variants from the audio.");
      }
    } catch (err) {
      this.voiceAddState.set('error');
      this.voiceAddError.set(err instanceof Error ? err.message : 'An unknown error occurred.');
    }
  }
  
  confirmVoiceAdd() {
    if (this.voiceConfirmForm.invalid) {
      this.voiceConfirmForm.markAllAsTouched();
      return;
    };

    const productData = this.voiceConfirmForm.value;
    const newProduct = this.inventoryService.addProduct({ name: productData.productName });
    for (const variant of productData.variants) {
      this.inventoryService.addVariant(newProduct.id, {
        name: variant.name,
        price: variant.price,
        cost: variant.cost,
        stock: variant.stock
      });
    }
    this.cancelVoiceAdd();
  }

  cancelVoiceAdd() {
    this.voiceAddState.set('idle');
    this.voiceAddError.set(null);
    this.voiceConfirmForm.reset();
    this.voiceConfirmVariants.clear();
  }
}