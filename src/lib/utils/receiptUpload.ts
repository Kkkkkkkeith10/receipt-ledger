function replaceExtension(fileName: string, nextExtension: string): string {
    return fileName.replace(/\.[^.]+$/, '') + nextExtension;
}

function buildRenderedPageFileName(fileName: string, pageNumber: number, extension: string): string {
    const stem = fileName.replace(/\.[^.]+$/, '');
    return `${stem}-page-${pageNumber}${extension}`;
}

function normalizePdfPageText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

export async function fixImageOrientation(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(file);
                return;
            }

            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }

                    resolve(
                        new File([blob], replaceExtension(file.name, '.jpg'), {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        }),
                    );
                },
                'image/jpeg',
                0.92,
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };

        img.src = url;
    });
}

export async function preparePdfForAI(file: File): Promise<{ images: File[]; extractedText: string | null }> {
    if (typeof window === 'undefined' || file.type !== 'application/pdf') {
        return { images: [], extractedText: null };
    }

    try {
        const pdfjs = await import('pdfjs-dist/webpack.mjs');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;

        try {
            const renderedPages: File[] = [];
            const pageCount = Math.min(pdf.numPages, 5);
            const shouldUseHighFidelityRender = pageCount <= 2;
            const extractedPages: string[] = [];

            for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
                const page = await pdf.getPage(pageNumber);

                try {
                    const textContent = await page.getTextContent();
                    const pageText = normalizePdfPageText(
                        textContent.items
                            .map((item) => ('str' in item ? item.str : ''))
                            .join(' '),
                    );

                    if (pageText) {
                        extractedPages.push(`Page ${pageNumber}: ${pageText}`);
                    }

                    const baseViewport = page.getViewport({ scale: 1 });
                    const longEdge = Math.max(baseViewport.width, baseViewport.height) || 1;
                    const scale = shouldUseHighFidelityRender
                        ? Math.min(2.25, 2200 / longEdge)
                        : Math.min(1.75, 1600 / longEdge);
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    canvas.width = Math.ceil(viewport.width);
                    canvas.height = Math.ceil(viewport.height);

                    const ctx = canvas.getContext('2d', { alpha: false });
                    if (!ctx) {
                        continue;
                    }

                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    await page.render({
                        canvasContext: ctx,
                        viewport,
                    }).promise;

                    const outputType = shouldUseHighFidelityRender ? 'image/png' : 'image/jpeg';
                    const blob = await new Promise<Blob | null>((resolve) => {
                        if (outputType === 'image/png') {
                            canvas.toBlob(resolve, outputType);
                            return;
                        }

                        canvas.toBlob(resolve, outputType, 0.9);
                    });

                    if (!blob) {
                        continue;
                    }

                    renderedPages.push(
                        new File(
                            [blob],
                            buildRenderedPageFileName(
                                file.name,
                                pageNumber,
                                outputType === 'image/png' ? '.png' : '.jpg',
                            ),
                            {
                            type: outputType,
                            lastModified: Date.now(),
                            },
                        ),
                    );
                } finally {
                    page.cleanup();
                }
            }

            const extractedText = extractedPages.join('\n\n').slice(0, 12000) || null;

            return {
                images: renderedPages,
                extractedText,
            };
        } finally {
            await pdf.destroy();
        }
    } catch (error) {
        console.warn('Failed to render PDF for AI upload', error);
        return { images: [], extractedText: null };
    }
}

export async function createReceiptUploadFormData(file: File): Promise<FormData> {
    const formData = new FormData();

    if (file.type === 'application/pdf') {
        const { images: aiImages, extractedText } = await preparePdfForAI(file);
        formData.append('file', file);
        for (const aiImage of aiImages) {
            formData.append('aiImage', aiImage);
        }
        if (extractedText) {
            formData.append('aiText', extractedText);
        }
        return formData;
    }

    const processedFile = await fixImageOrientation(file);
    formData.append('file', processedFile);
    return formData;
}