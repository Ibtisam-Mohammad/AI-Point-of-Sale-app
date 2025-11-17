import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { Product, ProductVariant } from './inventory.service';
import { OrderItem } from './order.service';

export interface ItemQuantity {
  productName: string;
  variantName: string; // e.g., "Small", "Regular"
  quantity: number;
}

export interface ProcessedOrder {
  transcript: string;
  items: ItemQuantity[];
  unrecognizedItems: string[];
}

export interface ParsedInventoryImageResult {
  recognizedItems: { itemName: string, quantity: number, variantId?: number }[];
  unrecognizedItems: { itemName: string, quantity: number, price?: number }[];
}

// Interfaces for voice-based inventory addition
export interface ParsedVariant {
  name: string; // e.g., "Small", "Regular"
  price: number;
  cost: number;
  stock: number;
}

export interface ParsedVoiceProduct {
  productName: string;
  variants: ParsedVariant[];
}


@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async processVoiceOrder(audioBase64: string, mimeType: string, inventory: Product[], currentOrder: OrderItem[]): Promise<ProcessedOrder> {
    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    };

    const textPart = { text: 'Process this voice order based on the system instructions.' };

    const inventoryList = inventory.map(p => 
      `${p.name} (variants: ${p.variants.map(v => `${v.name} at $${v.price.toFixed(2)}`).join(', ')})`
    ).join('; ');

    let systemInstruction = `You are a point-of-sale assistant.
Your task is to transcribe the user's audio order and identify the products, variants, and quantities they are asking for.
The user might use short or ambiguous names (e.g., "large cola"). For each item, return the base product name (e.g., "Classic Cola") and the specific variant name (e.g., "Large").
If a variant is not specified and the product has multiple options (e.g., user says just "cola"), return the productName but leave variantName empty or null.
If an item is mentioned that is clearly not related to any item in the inventory, add its name to the 'unrecognizedItems' array.
The available inventory is: ${inventoryList}.`;

    if (currentOrder.length > 0) {
        const currentOrderString = currentOrder.map(i => `${i.quantity}x ${i.name}`).join(', ');
        systemInstruction += `\n\nThe current order is: ${currentOrderString}.
The user's new instruction might be to add items, remove items, or change quantities of existing items.
Your response should represent the *complete, updated* list of items for the order. For example, if the current order is "1x Classic Cola (Small)" and the user says "add two chips", the new item list should contain both cola and chips.
The 'items' array in your JSON response must contain the final state of the order after the user's changes.`;
    }

    systemInstruction += `\nRespond in JSON format according to the provided schema.`;
    
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        transcript: { type: Type.STRING, description: 'The full transcription of the audio.' },
        items: {
          type: Type.ARRAY,
          description: currentOrder.length > 0
            ? "The complete and final list of items and quantities for the order after applying the user's modifications."
            : 'A list of items and quantities identified from the order.',
          items: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING, description: "The name of the base product (e.g., 'Classic Cola')." },
              variantName: { type: Type.STRING, description: "The name of the specific variant (e.g., 'Large', 'Regular'). Can be null if not specified by the user." },
              quantity: { type: Type.INTEGER, description: 'The quantity of the item ordered.' },
            },
            required: ['productName', 'quantity'],
          },
        },
        unrecognizedItems: {
          type: Type.ARRAY,
          description: 'A list of item names mentioned in the order but not found in the inventory.',
          items: { type: Type.STRING },
        },
      },
      required: ['transcript', 'items', 'unrecognizedItems'],
    };

    try {
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [audioPart, textPart] },
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            },
        });
      
      const jsonString = response.text.trim();
      if (!jsonString) {
        console.warn("Received an empty response from the AI.");
        return { transcript: 'Could not understand audio.', items: [], unrecognizedItems: [] };
      }
      const result: ProcessedOrder = JSON.parse(jsonString);
      return result;

    } catch (error) {
      console.error('Error processing voice order with Gemini:', error);
      if (error instanceof SyntaxError) {
         throw new Error('Failed to parse the AI response. It might not be valid JSON.');
      }
      throw new Error('Failed to process the audio order. Please try again.');
    }
  }

  async parseInventoryImage(imageBase64: string, mimeType: string, inventory: Product[]): Promise<ParsedInventoryImageResult> {
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    };

    const inventoryList = inventory.map(p => p.name).join(', ');

    const systemInstruction = `You are an inventory management assistant.
Analyze the provided image of a purchase receipt or products.
Identify each item and its quantity.
Compare the items against the provided inventory list of product names.
Categorize the items into 'recognizedItems' and 'unrecognizedItems'.
For recognized items, find the most likely product from the inventory and return its name.
For unrecognized items, include the price if you can identify it.
The available inventory products are: ${inventoryList}.
Respond in JSON format according to the provided schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        recognizedItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemName: { type: Type.STRING },
              quantity: { type: Type.INTEGER },
            },
            required: ['itemName', 'quantity'],
          },
        },
        unrecognizedItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
                itemName: { type: Type.STRING },
                quantity: { type: Type.INTEGER },
                price: { type: Type.NUMBER },
            },
            required: ['itemName', 'quantity'],
          }
        },
      },
      required: ['recognizedItems', 'unrecognizedItems'],
    };

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [imagePart, { text: 'Analyze this purchase.' }] },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const jsonString = response.text.trim();
      if (!jsonString) {
        return { recognizedItems: [], unrecognizedItems: [] };
      }
      const parsed = JSON.parse(jsonString);

      // Post-process to find default variant for recognized items
      const processedResult: ParsedInventoryImageResult = { recognizedItems: [], unrecognizedItems: parsed.unrecognizedItems };
      if (parsed.recognizedItems) {
        for (const item of parsed.recognizedItems) {
          const product = inventory.find(p => p.name.toLowerCase() === item.itemName.toLowerCase());
          if (product && product.variants.length > 0) {
            // Default to the first variant if multiple exist
            processedResult.recognizedItems.push({ ...item, variantId: product.variants[0].id });
          } else {
             // If not found, treat as unrecognized
            processedResult.unrecognizedItems.push(item);
          }
        }
      }

      return processedResult;

    } catch (error) {
      console.error('Error parsing inventory image with Gemini:', error);
      throw new Error('Failed to analyze the inventory image.');
    }
  }

  async processVoiceInventoryAdd(audioBase64: string, mimeType: string): Promise<ParsedVoiceProduct> {
    const audioPart = {
      inlineData: { mimeType, data: audioBase64 },
    };

    const systemInstruction = `You are an inventory creation assistant.
Listen to the user describing a new product.
Your task is to extract the main product name and details for one or more variants.
For each variant, you must extract its name (e.g., "Small", "12oz", "Light Roast"), its retail price, its cost to the business, and the starting stock quantity.
If the user provides only one set of details for a product, assume it's a 'Standard' or 'Regular' variant.
Example: User says 'Add a new product called Energy Drink. The small can is two dollars, costs me one dollar, and I have 50 in stock. The large can is three fifty, costs one fifty, and I have 30 in stock.'
You should extract 'Energy Drink' as the productName, and then two variants with their respective price, cost, and stock.
Respond in JSON format according to the provided schema. Ensure all fields are filled. If a value isn't mentioned, make a reasonable guess (e.g., cost as 40% of price).`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        productName: { type: Type.STRING, description: "The name of the new product." },
        variants: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "The name of the variant (e.g., 'Small', 'Standard')." },
              price: { type: Type.NUMBER, description: "The retail price of the variant." },
              cost: { type: Type.NUMBER, description: "The cost of the variant to the business." },
              stock: { type: Type.INTEGER, description: "The initial stock quantity for the variant." },
            },
            required: ['name', 'price', 'cost', 'stock'],
          },
        },
      },
      required: ['productName', 'variants'],
    };

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [audioPart, { text: 'Create a new inventory item from this audio.' }] },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const jsonString = response.text.trim();
      if (!jsonString) {
        throw new Error("The AI returned an empty response.");
      }
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error processing voice inventory add with Gemini:', error);
      throw new Error('Failed to understand the product description from the audio.');
    }
  }
}
