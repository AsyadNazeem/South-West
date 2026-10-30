
'use strict';

const { QueryTypes } = require('sequelize');
const db = require('../models');

async function generateItemCode(transaction) {
    if (!transaction) {
        throw new Error(
            'A database transaction is required to generate an item code'
        );
    }

    // Lock the sequence row to prevent duplicate codes
    // when multiple staff members create items simultaneously.
    const [counter] = await db.sequelize.query(
        `SELECT id, last_number
         FROM item_code_sequences
         WHERE sequence_name = :sequenceName
         FOR UPDATE`,
        {
            replacements: {
                sequenceName: 'item',
            },
            type: QueryTypes.SELECT,
            transaction,
        }
    );

    if (!counter) {
        throw new Error('Item code sequence has not been initialized');
    }

    const nextNumber = Number(counter.last_number) + 1;

    if (!Number.isSafeInteger(nextNumber) || nextNumber > 999999) {
        throw new Error('Item code sequence limit reached');
    }

    await db.sequelize.query(
        `UPDATE item_code_sequences
         SET last_number = :nextNumber,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = :id`,
        {
            replacements: {
                nextNumber,
                id: counter.id,
            },
            type: QueryTypes.UPDATE,
            transaction,
        }
    );

    return `SW-${String(nextNumber).padStart(6, '0')}`;
}

module.exports = {
    generateItemCode,
};
