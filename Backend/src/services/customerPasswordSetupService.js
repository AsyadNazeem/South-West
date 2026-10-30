
'use strict';

const crypto = require('crypto');
const db = require('../models');

const TOKEN_EXPIRY_MINUTES = 10;

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function createPasswordSetupInvitation(customerId, transaction) {
    if (!transaction) {
        throw new Error('A database transaction is required');
    }

    const customer = await db.Customer.findByPk(customerId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
    });

    if (!customer) {
        throw new Error('Customer not found');
    }

    if (!customer.email) {
        throw new Error('Customer has no email address');
    }

    if (customer.password_hash) {
        throw new Error('Customer already has a password');
    }

    // Generate a cryptographically secure, unpredictable token.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(
        Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000
    );

    // Invalidate any previous unused invitations for this customer.
    await db.CustomerPasswordSetupToken.update(
        { used_at: new Date() },
        {
            where: {
                customer_id: customer.id,
                used_at: null,
            },
            transaction,
        }
    );

    await db.CustomerPasswordSetupToken.create(
        {
            customer_id: customer.id,
            token_hash: tokenHash,
            expires_at: expiresAt,
        },
        { transaction }
    );

    return {
        token: rawToken,
        email: customer.email,
        customerCode: customer.customer_code,
        expiresAt,
    };
}

module.exports = {
    createPasswordSetupInvitation,
    hashToken,
    TOKEN_EXPIRY_MINUTES,
};
