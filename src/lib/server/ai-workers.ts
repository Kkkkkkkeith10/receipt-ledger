/**
 * AI Receipt Recognition Module - Cloudflare Workers Compatible
 * 
 * Uses native fetch API to call Azure OpenAI, compatible with Cloudflare Workers runtime.
 */

export interface AIConfig {
    endpoint: string;
    key: string;
    deployment: string;
}

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

export interface ReceiptRecognitionImageInput {
    imageBase64: string;
    mimeType: string;
}

/**
 * Receipt recognition prompt for multi-region businesses (HK, Japan, Taiwan)
 */
const RECEIPT_RECOGNITION_PROMPT = `Please review the following expense receipt uploaded by the user. The document may contain multiple page images from the same PDF receipt or booking confirmation. Use all provided pages together and extract the best single set of receipt details.

You should recognize the following details:
(1) The date of the expense (in YYYY-MM-DD format)
(2) Name of the company/vendor (English, Chinese, or Japanese)
(3) Description of the expense (keep it short and simple, within 10 words)
(4) Expense Category - Choose the MOST appropriate category from this list:
    - 'office_supplies': Paper, pens, stationery, basic office materials
    - 'travel': Business travel, flights, hotels, transportation, taxi, MTR, bus, train, shinkansen
    - 'meals_entertainment': Restaurant meals, client entertainment, business dinners
    - 'professional_services': Legal fees, accounting, consulting, audit
    - 'marketing': Website, advertising, promotional materials, business cards
    - 'utilities': Internet, phone, mobile, electricity (business portion)
    - 'rent': Office rent, co-working space, storage
    - 'software': SaaS subscriptions, licenses, cloud services, IT
    - 'insurance': Business insurance, professional indemnity
    - 'training': Courses, seminars, professional development, certifications
    - 'bank_charges': Bank fees, transaction charges, interest
    - 'repairs': Equipment repairs, maintenance (revenue nature, not capital)
    - 'other': If none of the above categories fit

(5) Total Amount Spent (should be a number, be careful of other numbers like change given, card numbers, or balance amounts - we want the TOTAL amount paid)
    - For JPY (Japanese Yen): amounts are typically whole numbers without decimals
    - For TWD (Taiwan Dollar): amounts are typically whole numbers without decimals
    - For HKD: amounts usually have 2 decimal places

(6) Currency - IMPORTANT: Detect the currency based on these indicators:
    - HKD (Hong Kong Dollar): Look for HK$, HKD, $ with Hong Kong context
    - JPY (Japanese Yen): Look for ¥, 円, JPY, Japanese text/vendors
    - TWD (Taiwan Dollar): Look for NT$, TWD, 元 (with Taiwan context), NTD
    - USD: Look for US$, USD, $ with US context
    - CNY: Look for ¥, CNY, RMB, 人民币 with China context
    - If currency cannot be determined, default to 'HKD'

(7) Payment method if visible (cash, card, octopus, alipay, wechat_pay, payme, fps, bank_transfer, suica, pasmo, icoca, linepay, jkopay, etc.)

REGIONAL NOTES:

HONG KONG:
- Hong Kong has NO GST/VAT, so ignore any "tax" line items (they might be service charges)
- Common HK vendors: ParknShop, Wellcome, 7-Eleven, Circle K, Starbucks, Pacific Coffee, Maxim's, Fairwood, Café de Coral
- Chinese characters are common - vendor names can be in Traditional Chinese
- Transportation: MTR (subway), taxi, bus, tram
- Do NOT confuse service charges (10%) with tax

JAPAN:
- Japan has consumption tax (消費税) typically 10% - report as gstAmount if visible
- Common Japan vendors: 7-Eleven, Lawson, FamilyMart, Uniqlo, Don Quijote, Daiso
- Japanese characters (hiragana, katakana, kanji) are common
- Transportation: JR, Metro, Shinkansen, taxi
- Look for 税込 (tax included) or 税抜 (before tax)

TAIWAN:
- Taiwan has 營業稅 (Business Tax/VAT) at 5% - report as gstAmount if visible
- Common Taiwan vendors: 7-Eleven, FamilyMart, PX Mart (全聯), Carrefour, Costco
- Traditional Chinese characters are used
- Transportation: MRT, Taiwan Railways, High Speed Rail (高鐵), taxi
- Look for 統一發票 (Uniform Invoice) with invoice number

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

/**
 * Call Azure OpenAI Vision API using native fetch
 */
async function callAzureVision(
    images: ReceiptRecognitionImageInput[],
    config: AIConfig,
    documentText?: string | null
): Promise<string> {
    // Build Azure OpenAI endpoint URL
    const apiVersion = '2024-02-15-preview';
    const url = `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${apiVersion}`;

    console.log('[AI-FETCH] Calling Azure OpenAI API...');
    console.log('[AI-FETCH] URL:', url);
    console.log('[AI-FETCH] Image count:', images.length);
    console.log('[AI-FETCH] Image types:', images.map((image) => image.mimeType).join(', '));
    console.log('[AI-FETCH] Supplemental text length:', documentText?.length ?? 0);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': config.key
        },
        body: JSON.stringify({
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: RECEIPT_RECOGNITION_PROMPT
                        },
                        ...(documentText
                            ? [
                                {
                                    type: 'text',
                                    text: `Supplemental extracted text from the same PDF. This text may be noisy, but use it to identify totals, booking amounts, room rates, cancellation percentages, or other price information that is hard to read visually. If the text and image disagree, prefer the amount that is explicitly labeled as the booking total or total paid.\n\n${documentText}`
                                }
                            ]
                            : []),
                        ...images.map((image) => ({
                            type: 'image_url',
                            image_url: {
                                url: `data:${image.mimeType};base64,${image.imageBase64}`,
                                detail: 'high'
                            }
                        }))
                    ]
                }
            ],
            max_completion_tokens: 1000
        })
    });

    console.log('[AI-FETCH] Response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI-FETCH] API Error:', response.status, errorText);
        throw new Error(`Azure OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as any;
    console.log('[AI-FETCH] API Response:', JSON.stringify(data, null, 2));
    const content = data.choices[0]?.message?.content || '';
    console.log('[AI-FETCH] Extracted content length:', content.length);
    return content;
}

/**
 * Recognize receipt from image using Azure OpenAI Vision
 */
export async function recognizeReceipt(
    images: ReceiptRecognitionImageInput[],
    config: AIConfig,
    documentText?: string | null
): Promise<RecognizedReceipt | { error: string }> {
    try {
        console.log('[AI] Starting receipt recognition...');
        console.log('[AI] Endpoint:', config.endpoint);
        console.log('[AI] Deployment:', config.deployment);
        console.log('[AI] Image count:', images.length);
        console.log('[AI] Supplemental text length:', documentText?.length ?? 0);

        const responseText = await callAzureVision(images, config, documentText);
        console.log('[AI] Raw response:', responseText);

        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[AI] No JSON found in response');
            return { error: 'Failed to parse AI response' };
        }

        const recognized = JSON.parse(jsonMatch[0]) as RecognizedReceipt;
        console.log('[AI] Parsed result:', recognized);

        return recognized;
    } catch (error) {
        console.error('[AI] Recognition error:', error);
        return {
            error: error instanceof Error ? error.message : 'Recognition failed'
        };
    }
}
