
'use strict';

const { QueryTypes } = require('sequelize');
const db = require('../models');

const CUSTOMER_TYPES = {
    SELF_REGISTERED: {
        value: 'self_registered',
        prefix: 'SRCUS',
    },
    STAFF_CREATED: {
        value: 'staff_created',
        prefix: 'STFFCUS',
    },
};

async function generateCustomerCode(customerType, transaction) {
    if (!transaction) {
        throw new Error(
            'A database transaction is required to generate a customer code'
        );
    }

    const typeConfig = Object.values(CUSTOMER_TYPES).find(
        (type) => type.value === customerType
    );

    if (!typeConfig) {
        throw new Error('Invalid customer type');
    }

    // Use the database server's year consistently.
    const [yearRow] = await db.sequelize.query(
        'SELECT YEAR(CURRENT_DATE()) AS current_year',
        {
            type: QueryTypes.SELECT,
            transaction,
        }
    );

    const year = Number(yearRow.current_year);

    // Create the counter row if it doesn't exist.
    await db.sequelize.query(
        `INSERT INTO customer_code_sequences
            (customer_type, sequence_year, last_number, created_at, updated_at)
         VALUES (:customerType, :year, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE id = id`,
        {
            replacements: {
                customerType,
                year,
            },
            type: QueryTypes.INSERT,
            transaction,
        }
    );

    // Lock the counter row so concurrent transactions cannot take
    // the same sequence number.
    const [counter] = await db.sequelize.query(
        `SELECT id, last_number
         FROM customer_code_sequences
         WHERE customer_type = :customerType
           AND sequence_year = :year
         FOR UPDATE`,
        {
            replacements: {
                customerType,
                year,
            },
            type: QueryTypes.SELECT,
            transaction,
        }
    );

    if (!counter) {
        throw new Error('Unable to initialize customer code sequence');
    }

    const nextNumber = Number(counter.last_number) + 1;

    if (nextNumber > 99999) {
        throw new Error('Customer code sequence limit reached for this year');
    }

    await db.sequelize.query(
        `UPDATE customer_code_sequences
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

    return `${typeConfig.prefix}${year}${String(nextNumber).padStart(5, '0')}`;
}

module.exports = {
    CUSTOMER_TYPES,
    generateCustomerCode,
};
