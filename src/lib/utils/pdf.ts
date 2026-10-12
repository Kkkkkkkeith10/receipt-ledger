/**
 * PDF Conversion Utilities
 * 
 * Converts images to PDF documents for receipt storage.
 * Uses pdf-lib for PDF generation.
 */

import { PDFDocument, rgb } from 'pdf-lib';

// A4 dimensions in points (72 points per inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;

export interface PdfMetadata {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    creationDate?: Date;
    receiptNumber?: string;
    vendor?: string;
    amount?: number;
}

/**
 * Convert an image (JPEG/PNG) to a PDF document
 */
export async function imageToPdf(
    imageData: ArrayBuffer | Uint8Array,
    mimeType: string,
    metadata?: PdfMetadata
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();

    // Set metadata
    if (metadata) {
        if (metadata.title) pdfDoc.setTitle(metadata.title);
        if (metadata.author) pdfDoc.setAuthor(metadata.author);
        if (metadata.subject) pdfDoc.setSubject(metadata.subject);
        pdfDoc.setCreator(metadata.creator || 'Receipt Ledger');
        pdfDoc.setCreationDate(metadata.creationDate || new Date());

        // Add custom metadata as keywords
        const keywords: string[] = [];
        if (metadata.receiptNumber) keywords.push(`Receipt: ${metadata.receiptNumber}`);
        if (metadata.vendor) keywords.push(`Vendor: ${metadata.vendor}`);
        if (metadata.amount) keywords.push(`Amount: $${metadata.amount.toFixed(2)}`);
        if (keywords.length > 0) {
            pdfDoc.setKeywords(keywords);
        }
    }

    // Embed the image based on type
    let image;
    const imageBytes = imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData);

    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        image = await pdfDoc.embedJpg(imageBytes);
    } else if (mimeType === 'image/png') {
        image = await pdfDoc.embedPng(imageBytes);
    } else {
        throw new Error(`Unsupported image type: ${mimeType}. Use JPEG or PNG.`);
    }

    // Get image dimensions
    const imgWidth = image.width;
    const imgHeight = image.height;

    // Calculate scaling to fit within A4 with margins
    const maxWidth = A4_WIDTH - 2 * MARGIN;
    const maxHeight = A4_HEIGHT - 2 * MARGIN;

    const scaleX = maxWidth / imgWidth;
    const scaleY = maxHeight / imgHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;

    // Create page and draw image centered
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    const x = (A4_WIDTH - scaledWidth) / 2;
    const y = (A4_HEIGHT - scaledHeight) / 2;

    page.drawImage(image, {
        x,
        y,
        width: scaledWidth,
        height: scaledHeight
    });

    // Add receipt number watermark if provided
    if (metadata?.receiptNumber) {
        page.drawText(metadata.receiptNumber, {
            x: MARGIN,
            y: A4_HEIGHT - 25,
            size: 10,
            color: rgb(0.5, 0.5, 0.5)
        });
    }

    // Add timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    page.drawText(`Uploaded: ${timestamp}`, {
        x: A4_WIDTH - MARGIN - 100,
        y: A4_HEIGHT - 25,
        size: 8,
        color: rgb(0.6, 0.6, 0.6)
    });

    return pdfDoc.save();
}

/**
 * Convert multiple images to a single PDF (multi-page)
 */
export async function imagesToPdf(
    images: Array<{ data: ArrayBuffer | Uint8Array; mimeType: string }>,
    metadata?: PdfMetadata
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();

    // Set metadata
    if (metadata) {
        if (metadata.title) pdfDoc.setTitle(metadata.title);
        if (metadata.author) pdfDoc.setAuthor(metadata.author);
        if (metadata.subject) pdfDoc.setSubject(metadata.subject);
        pdfDoc.setCreator(metadata.creator || 'Receipt Ledger');
        pdfDoc.setCreationDate(metadata.creationDate || new Date());
    }

    for (let i = 0; i < images.length; i++) {
        const { data, mimeType } = images[i];
        const imageBytes = data instanceof Uint8Array ? data : new Uint8Array(data);

        let image;
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            image = await pdfDoc.embedJpg(imageBytes);
        } else if (mimeType === 'image/png') {
            image = await pdfDoc.embedPng(imageBytes);
        } else {
            console.warn(`Skipping unsupported image type: ${mimeType}`);
            continue;
        }

        const imgWidth = image.width;
        const imgHeight = image.height;

        const maxWidth = A4_WIDTH - 2 * MARGIN;
        const maxHeight = A4_HEIGHT - 2 * MARGIN;

        const scaleX = maxWidth / imgWidth;
        const scaleY = maxHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;

        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

        const x = (A4_WIDTH - scaledWidth) / 2;
        const y = (A4_HEIGHT - scaledHeight) / 2;

        page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight
        });

        // Add page number
        page.drawText(`Page ${i + 1} of ${images.length}`, {
            x: A4_WIDTH / 2 - 30,
            y: 20,
            size: 8,
            color: rgb(0.6, 0.6, 0.6)
        });
    }

    return pdfDoc.save();
}

/**
 * Check if the data is already a PDF
 */
export function isPdf(data: ArrayBuffer | Uint8Array): boolean {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    // PDF magic number: %PDF
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/**
 * Get the MIME type from magic bytes
 */
export function detectMimeType(data: ArrayBuffer | Uint8Array): string | null {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
    ) {
        return 'image/png';
    }

    // PDF: %PDF
    if (
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
    ) {
        return 'application/pdf';
    }

    // WebP: RIFF....WEBP
    if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'image/webp';
    }

    return null;
}

/**
 * Convert a base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    // Handle data URLs
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
