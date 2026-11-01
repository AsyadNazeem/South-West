'use strict';

const { Item, ItemImage } = require('../models');
const { buildFileUrl } = require('../utils/fileStorage');

const SITE_ORIGIN = (
    process.env.PUBLIC_SITE_URL || 'https://southwest.lk'
).replace(/\/+$/, '');

const API_ORIGIN = (
    process.env.PUBLIC_API_URL || 'https://api.southwest.lk'
).replace(/\/+$/, '');

const UUID_PATTERN =
    /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function plainText(value) {
    return String(value ?? '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);
}

function absoluteImageUrl(value) {
    if (!value) return null;

    const imagePath = String(value).trim();

    if (/^https?:\/\//i.test(imagePath)) {
        return imagePath;
    }

    if (imagePath.startsWith('//')) {
        return `https:${imagePath}`;
    }

    return new URL(
        imagePath.startsWith('/') ? imagePath : `/${imagePath}`,
        `${API_ORIGIN}/`
    ).toString();
}

async function getProductSocialPreview(req, res) {
    try {
        const slug = String(req.params.slug || '');
        const match = slug.match(UUID_PATTERN);

        if (!match) {
            return res.status(400).type('text').send('Invalid product URL');
        }

        const product = await Item.findOne({
            where: {
                public_id: match[1],
                is_active: true,
            },
            attributes: [
                'id',
                'public_id',
                'slug',
                'item_name',
                'description',
            ],
        });

        if (!product) {
            return res.status(404).type('text').send('Product not found');
        }

        const image = await ItemImage.findOne({
            where: {
                item_id: product.id,
                is_active: true,
            },
            attributes: [
                'file_path',
                'alt_text',
                'is_primary',
            ],
            order: [
                ['is_primary', 'DESC'],
                ['sort_order', 'ASC'],
                ['id', 'ASC'],
            ],
        });

        const title = `${product.item_name} | South West`;
        const description = plainText(product.description) ||
            `Discover ${product.item_name} at South West.`;

        const canonicalSlug = product.slug || slug;
        const canonicalUrl = new URL(
            `/product/${encodeURIComponent(canonicalSlug)}`,
            `${SITE_ORIGIN}/`
        ).toString();

        const storedImageUrl = image
            ? buildFileUrl(image.file_path)
            : null;

        // This fallback image must be added to Customer/public before launch.
        const imageUrl = absoluteImageUrl(storedImageUrl) ||
            `${SITE_ORIGIN}/SWShareImage.png`;

        const imageAlt = image?.alt_text || product.item_name;

        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">

<meta property="og:type" content="product">
<meta property="og:site_name" content="South West">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">
</head>
<body>
<p>View ${escapeHtml(product.item_name)} at South West.</p>
<a href="${escapeHtml(canonicalUrl)}">View product</a>
</body>
</html>`;

        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        return res.status(200).type('html').send(html);
    } catch (error) {
        console.error('Product social preview failed:', error.message);

        return res.status(500).type('text').send(
            'Unable to generate product preview'
        );
    }
}

module.exports = {
    getProductSocialPreview,
    escapeHtml,
    plainText,
    absoluteImageUrl,
};
