import sharp from 'sharp';
import { mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../static/icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
    // Create a simple icon buffer
    const svgBuffer = Buffer.from(`
		<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
			<rect width="512" height="512" rx="64" fill="#3b82f6"/>
			<text x="256" y="340" font-family="Arial, sans-serif" font-size="280" font-weight="bold" text-anchor="middle" fill="white">$</text>
		</svg>
	`);

    await mkdir(iconsDir, { recursive: true });

    for (const size of sizes) {
        const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`Generated: icon-${size}x${size}.png`);
    }

    console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
