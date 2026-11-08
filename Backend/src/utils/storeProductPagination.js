'use strict';

const crypto = require('crypto');
const { literal } = require('sequelize');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 25;
const SEED_PATTERN = /^[a-f0-9]{32}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;

function createSeed() {
    return crypto.randomBytes(16).toString('hex');
}

function parseLimit(value) {
    if (value === undefined || value === null || value === '') {
        return DEFAULT_LIMIT;
    }

    if (!/^\d+$/.test(String(value))) return DEFAULT_LIMIT;

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return DEFAULT_LIMIT;
    }

    return Math.min(parsed, MAX_LIMIT);
}

function validateSeed(seed) {
    return typeof seed === 'string' && SEED_PATTERN.test(seed);
}

function sortQueryValue(value) {
    if (Array.isArray(value)) return value.map(sortQueryValue);

    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = sortQueryValue(value[key]);
            return result;
        }, {});
    }

    return value;
}

function createQueryFingerprint(query) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(sortQueryValue(query || {})))
        .digest('hex');
}

function createStoreProductQueryFingerprint({
    filters,
    sort,
    campaigns = [],
    imageItemIds = [],
}) {
    const campaignFingerprint = campaigns
        .map(campaign => ({
            target_type: campaign.target_type,
            discount_type: campaign.discount_type,
            discount_value: String(campaign.discount_value),
            itemIds: (campaign.campaignItems || [])
                .map(row => String(row.item_id))
                .sort(),
            categoryIds: (campaign.campaignCategories || [])
                .map(row => String(row.category_id))
                .sort(),
            brandIds: (campaign.campaignBrands || [])
                .map(row => String(row.brand_id))
                .sort(),
        }))
        .sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b))
        );

    return createQueryFingerprint({
        filters,
        sort,
        campaigns: campaignFingerprint,
        imageItemIds: imageItemIds.map(String).sort(),
    });
}

function getSigningSecret(secret = process.env.JWT_SECRET) {
    if (typeof secret !== 'string' || secret.length < 32) {
        throw new Error('A valid cursor signing secret is required.');
    }

    return secret;
}

function signPayload(payload, secret) {
    return crypto
        .createHmac('sha256', getSigningSecret(secret))
        .update(payload)
        .digest('base64url');
}

function createCursor(score, id, seed, queryHash, secret, sortValue = null) {
    if (!validateSeed(seed) || !HASH_PATTERN.test(queryHash)) {
        throw new Error('Invalid pagination cursor context.');
    }

    const numericScore = Number(score);
    const productId = String(id);

    if (
        !Number.isInteger(numericScore) ||
        numericScore < 0 ||
        numericScore > 4294967295 ||
        !/^[1-9]\d*$/.test(productId)
    ) {
        throw new Error('Invalid pagination cursor position.');
    }

    const payload = Buffer.from(JSON.stringify({
        seed,
        queryHash,
        score: numericScore,
        id: productId,
        ...(sortValue !== null && sortValue !== undefined
            ? { sortValue: String(sortValue) }
            : {}),
    })).toString('base64url');

    return `${payload}.${signPayload(payload, secret)}`;
}

function parseCursor(token, expectedSeed, expectedQueryHash, secret) {
    if (
        typeof token !== 'string' ||
        !token ||
        !validateSeed(expectedSeed) ||
        !HASH_PATTERN.test(expectedQueryHash)
    ) {
        return null;
    }

    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [payload, suppliedSignature] = parts;
        const expectedSignature = signPayload(payload, secret);
        const supplied = Buffer.from(suppliedSignature, 'base64url');
        const expected = Buffer.from(expectedSignature, 'base64url');

        if (
            supplied.length !== expected.length ||
            !crypto.timingSafeEqual(supplied, expected)
        ) {
            return null;
        }

        const decoded = JSON.parse(
            Buffer.from(payload, 'base64url').toString('utf8')
        );

        if (
            decoded.seed !== expectedSeed ||
            decoded.queryHash !== expectedQueryHash ||
            !Number.isInteger(decoded.score) ||
            decoded.score < 0 ||
            decoded.score > 4294967295 ||
            typeof decoded.id !== 'string' ||
            !/^[1-9]\d*$/.test(decoded.id) ||
            (
                decoded.sortValue !== null &&
                decoded.sortValue !== undefined &&
                typeof decoded.sortValue !== 'string'
            )
        ) {
            return null;
        }

        return {
            score: decoded.score,
            id: decoded.id,
            ...(decoded.sortValue !== undefined
                ? { sortValue: decoded.sortValue }
                : {}),
        };
    } catch {
        return null;
    }
}

function getShuffleScoreExpression(seed) {
    if (!validateSeed(seed)) {
        throw new Error('Invalid pagination seed.');
    }

    return literal(`CRC32(CONCAT('${seed}', items.id))`);
}

module.exports = {
    DEFAULT_LIMIT,
    MAX_LIMIT,
    createSeed,
    parseLimit,
    validateSeed,
    createQueryFingerprint,
    createStoreProductQueryFingerprint,
    createCursor,
    parseCursor,
    getShuffleScoreExpression,
};
