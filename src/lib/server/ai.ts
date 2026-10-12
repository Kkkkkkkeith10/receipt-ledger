/**
 * AI Receipt Recognition Module - Using LlamaIndex
 * 
 * Uses @llamaindex/azure for Azure OpenAI integration, following the same pattern as aiv4.
 */

import { AzureOpenAI } from '@llamaindex/azure';
import { Settings, type ChatMessage, type LLMChatParamsNonStreaming } from 'llamaindex';

export interface AIConfig {
    endpoint: string;
    key: string;
    deployment: string;
}

/**
 * Create Azure OpenAI client using LlamaIndex
 */
export function createAzureClient(config: AIConfig): AzureOpenAI {
    return new AzureOpenAI({
        apiKey: config.key,
        endpoint: config.endpoint,
        deployment: config.deployment
    });
}

/**
 * Simple chat completion using LlamaIndex
 */
export async function getChatCompletion(
    prompt: string,
    config: AIConfig
): Promise<string | null> {
    const client = createAzureClient(config);
    Settings.llm = client as any;

    const messages: ChatMessage[] = [
        { role: 'user', content: prompt }
    ];

    try {
        const response = await Settings.llm.chat({
            messages,
            stream: false
        });
        return String(response?.message?.content) || null;
    } catch (e) {
        console.error('Chat completion error:', e);
        return null;
    }
}

/**
 * Receipt recognition prompt for Hong Kong businesses
 */
export const RECEIPT_RECOGNITION_PROMPT = `Please review the following expense receipt uploaded by the user. Help the user to recognize all the details in the document/receipt image.

You should recognize the following details:
(1) The date of the expense (in YYYY-MM-DD format)
(2) Name of the company/vendor (English is preferred when available)
(3) Description of the expense (keep it short and simple, within 10 words)
(4) Expense Category (the following are available: 'project_materials', 'office_supplies', 'travel', 'food_beverage', 'fuel_vehicle', 'subscriptions', 'professional_services', 'utilities', 'marketing', 'training', 'other')
(5) Total Amount Spent (should be a number with 2 decimal places, be careful of other numbers like change given, card numbers, or balance amounts - we want the TOTAL amount paid)
(6) Tax Amount if shown separately (should be a number with 2 decimal places, usually 0 for Hong Kong receipts as HK has no GST/VAT)
(7) Currency (if not specified, assume HKD for Hong Kong dollars)
(8) BR Number (Business Registration Number) of the vendor if visible (8 digits)
(9) Payment method if visible (cash, card, octopus, fps, payme, etc.)

Return null for any field if the information is not available or cannot be recognized. Do not provide any information that is not clearly visible in the document.

Give your response in the following JSON format:
{
  "date": string | null,
  "vendor": string | null,
  "description": string | null,
  "category": string | null,
  "amount": number | null,
  "gstAmount": number | null,
  "currency": string,
  "brNumber": string | null,
  "paymentMethod": string | null,
  "confidence": number
}

The "confidence" field should be a number between 0 and 1 indicating how confident you are in the accuracy of the extracted data (1 = very confident, 0 = very uncertain).
`;

export interface RecognizedReceipt {
    date: string | null;
    vendor: string | null;
    description: string | null;
    category: string | null;
    amount: number | null;
    gstAmount: number | null;
    currency: string;
    brNumber: string | null;
    paymentMethod: string | null;
    confidence: number;
}

/**
 * Recognize expense receipt from an image using LlamaIndex
 */
export async function recognizeReceipt(
    imageBase64: string,
    mimeType: string,
    config: AIConfig
): Promise<RecognizedReceipt | { error: string }> {
    const client = createAzureClient(config);
    Settings.llm = client as any;

    // Build message with image content
    const messages: ChatMessage[] = [
        {
            role: 'user',
            content: [
                { type: 'text', text: RECEIPT_RECOGNITION_PROMPT },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${imageBase64}`,
                        detail: 'high'
                    }
                }
            ] as any
        }
    ];

    try {
        const chatOptions: LLMChatParamsNonStreaming = {
            messages,
            stream: false,
            additionalChatOptions: {
                temperature: 0,
                response_format: { type: 'json_object' }
            }
        };

        const response = await Settings.llm.chat(chatOptions);
        const content = String(response?.message?.content);

        console.log('Receipt recognition result:', content);

        if (!content) {
            return { error: 'Recognition failed - no response from AI' };
        }

        const parsed = JSON.parse(content) as RecognizedReceipt;

        // Ensure currency defaults to HKD if not specified
        if (!parsed.currency) {
            parsed.currency = 'HKD';
        }

        return parsed;
    } catch (e: any) {
        console.error('Azure OpenAI Error:', e);
        return { error: e?.message || 'Recognition failed' };
    }
}

/**
 * Calculate tax from total amount
 * Note: Hong Kong has no GST/VAT, this is kept for compatibility with imported receipts
 */
export function calculateGST(totalAmount: number, gstIncluded = true): {
    gstAmount: number;
    exGstAmount: number;
    incGstAmount: number;
} {
    // Hong Kong has no GST, return 0 for tax
    return {
        gstAmount: 0,
        exGstAmount: totalAmount,
        incGstAmount: totalAmount
    };
}
