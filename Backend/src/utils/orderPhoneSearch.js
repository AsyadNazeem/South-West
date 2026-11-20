'use strict';

const { Sequelize } = require('sequelize');

const PHONE_LIKE_INPUT = /^[+\d\s().-]+$/;
const SAFE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

function normalizePhoneSearch(value) {
    const input = String(value || '').trim();
    if (!input || !PHONE_LIKE_INPUT.test(input)) return null;
    const digits = input.replace(/\D/g, '');
    return digits.length >= 3 ? digits : null;
}

function phoneSearchVariants(value) {
    const digits = normalizePhoneSearch(value);
    if (!digits) return [];

    const variants = new Set([digits]);
    if (digits.startsWith('94') && digits.length > 2) {
        variants.add(`0${digits.slice(2)}`);
    } else if (digits.startsWith('0') && digits.length > 1) {
        variants.add(`94${digits.slice(1)}`);
    }
    return [...variants];
}

function quoteIdentifier(value) {
    if (!SAFE_IDENTIFIER.test(value)) {
        throw new Error('Unsafe SQL identifier in phone search.');
    }
    return `\`${value}\``;
}

function quoteColumn(path) {
    return String(path).split('.').map(quoteIdentifier).join('.');
}

function normalizedSql(column) {
    return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), ` +
        `' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '.', '')`;
}

function likeSql(column, variants, prefix) {
    const normalized = normalizedSql(column);
    return variants.map((_, index) => `${normalized} LIKE :${prefix}${index}`).join(' OR ');
}

function buildOrderPhoneSearch(value, {
    orderAlias = 'order',
    directPhoneColumns = [],
    replacementPrefix = 'phoneSearch'
} = {}) {
    const variants = phoneSearchVariants(value);
    if (!variants.length) return null;

    const order = quoteIdentifier(orderAlias);
    const addressAlias = quoteIdentifier(`${replacementPrefix}Address`);
    const customerAlias = quoteIdentifier(`${replacementPrefix}Customer`);
    const addressPhone = `${addressAlias}.\`phone\``;
    const predicates = directPhoneColumns.map(column =>
        `(${likeSql(quoteColumn(column), variants, replacementPrefix)})`
    );

    const shippingMatch = `EXISTS (` +
        `SELECT 1 FROM \`order_addresses\` AS ${addressAlias} ` +
        `WHERE ${addressAlias}.\`order_id\` = ${order}.\`id\` ` +
        `AND ${addressAlias}.\`address_type\` = 'shipping' ` +
        `AND (${likeSql(addressPhone, variants, replacementPrefix)})` +
        `)`;
    const shippingPhoneExists = `EXISTS (` +
        `SELECT 1 FROM \`order_addresses\` AS ${addressAlias} ` +
        `WHERE ${addressAlias}.\`order_id\` = ${order}.\`id\` ` +
        `AND ${addressAlias}.\`address_type\` = 'shipping' ` +
        `AND NULLIF(TRIM(${addressPhone}), '') IS NOT NULL` +
        `)`;
    const customerFallback = `EXISTS (` +
        `SELECT 1 FROM \`customers\` AS ${customerAlias} ` +
        `WHERE ${customerAlias}.\`id\` = ${order}.\`customer_id\` ` +
        `AND (${likeSql(`${customerAlias}.\`phone\``, variants, replacementPrefix)})` +
        `)`;

    predicates.push(shippingMatch);
    predicates.push(`(NOT ${shippingPhoneExists} AND ${customerFallback})`);

    return {
        condition: Sequelize.literal(`(${predicates.join(' OR ')})`),
        replacements: Object.fromEntries(
            variants.map((variant, index) => [
                `${replacementPrefix}${index}`,
                `%${variant}%`
            ])
        ),
        variants
    };
}

module.exports = {
    buildOrderPhoneSearch,
    normalizePhoneSearch,
    phoneSearchVariants
};
