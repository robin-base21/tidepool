import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { imageMimeTypes, postImages, type ImageMimeType } from './db/schema';
import { requiredOr } from './validation';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const DATA_URL_PREFIX = /^data:([^;,]+);base64,/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

const signatures: Record<ImageMimeType, (data: Buffer) => boolean> = {
	'image/jpeg': (data) => data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
	'image/png': (data) =>
		data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
	'image/webp': (data) =>
		data.subarray(0, 4).toString('latin1') === 'RIFF' &&
		data.subarray(8, 12).toString('latin1') === 'WEBP'
};

function isImageMimeType(mime: string): mime is ImageMimeType {
	return (imageMimeTypes as readonly string[]).includes(mime);
}

function formatBytes(bytes: number): string {
	return `${bytes.toLocaleString('en')} bytes`;
}

export type ImageUpload = { mime: ImageMimeType; data: Buffer };

/** Parses `data:image/<jpeg|png|webp>;base64,...`, checking the MIME type, decoded size and file signature. */
export const imageDataUrlSchema = z
	.string({ error: requiredOr('must be a data URL string') })
	.transform((dataUrl, context): ImageUpload => {
		const prefix = DATA_URL_PREFIX.exec(dataUrl);
		if (prefix === null) {
			context.addIssue({
				code: 'custom',
				message: 'must be a base64 data URL, e.g. data:image/jpeg;base64,...'
			});
			return z.NEVER;
		}

		const mime = prefix[1].toLowerCase();
		if (!isImageMimeType(mime)) {
			context.addIssue({
				code: 'custom',
				message: `must be ${imageMimeTypes.join(', ')} (got ${mime})`
			});
			return z.NEVER;
		}

		const base64 = dataUrl.slice(prefix[0].length);
		if (base64.length % 4 !== 0 || !BASE64.test(base64)) {
			context.addIssue({ code: 'custom', message: 'is not valid base64' });
			return z.NEVER;
		}

		const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
		const decodedBytes = (base64.length / 4) * 3 - padding;
		if (decodedBytes > MAX_IMAGE_BYTES) {
			context.addIssue({
				code: 'custom',
				message: `must be at most 5 MB (${formatBytes(MAX_IMAGE_BYTES)}) decoded; got ${formatBytes(decodedBytes)}`
			});
			return z.NEVER;
		}

		const data = Buffer.from(base64, 'base64');
		if (!signatures[mime](data)) {
			context.addIssue({ code: 'custom', message: `content is not a valid ${mime} file` });
			return z.NEVER;
		}
		return { mime, data };
	});

export function getPostImage(postId: number): ImageUpload | undefined {
	return db()
		.select({ mime: postImages.mime, data: postImages.data })
		.from(postImages)
		.where(eq(postImages.postId, postId))
		.get();
}

/** Serves a stored image as-is; `cacheControl` differs between the API and the public feed. */
export function imageResponse(image: ImageUpload, cacheControl: string): Response {
	return new Response(new Uint8Array(image.data), {
		headers: {
			'content-type': image.mime,
			'content-length': String(image.data.length),
			'cache-control': cacheControl,
			'x-content-type-options': 'nosniff'
		}
	});
}
