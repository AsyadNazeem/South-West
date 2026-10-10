
const {
    Customer,
    CustomerAddress,
    CustomerSession,
    sequelize,
} = require('../models');

const ALLOWED_UPDATE_FIELDS = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'is_active',
];

function normalizeOptionalString(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function normalizeEmail(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? trimmed.toLowerCase() : null;
}

function sanitizeCustomer(customer) {
    const data = customer.toJSON();

    // Never return authentication or verification secrets.
    delete data.password_hash;

    // Avoid exposing internal verification metadata through staff CRUD.
    delete data.email_verified_at;
    delete data.phone_verified_at;

    return data;
}

function validateCustomerFields(fields, { creating = false } = {}) {
    const errors = [];

    for (const field of ['first_name', 'last_name', 'phone']) {
        if (creating && !fields[field]) {
            errors.push(`${field} is required.`);
        } else if (
            fields[field] !== undefined &&
            (typeof fields[field] !== 'string' ||
                !fields[field].trim())
        ) {
            errors.push(`${field} must be a non-empty string.`);
        }
    }

    if (
        fields.first_name !== undefined &&
        typeof fields.first_name === 'string' &&
        fields.first_name.trim().length > 100
    ) {
        errors.push('First name must not exceed 100 characters.');
    }

    if (
        fields.last_name !== undefined &&
        typeof fields.last_name === 'string' &&
        fields.last_name.trim().length > 100
    ) {
        errors.push('Last name must not exceed 100 characters.');
    }

    if (
        fields.email !== undefined &&
        fields.email !== null &&
        fields.email !== ''
    ) {
        if (
            typeof fields.email !== 'string' ||
            fields.email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())
        ) {
            errors.push('A valid email address is required.');
        }
    }

    if (
        fields.phone !== undefined &&
        typeof fields.phone === 'string' &&
        fields.phone.trim().length > 30
    ) {
        errors.push('Phone must not exceed 30 characters.');
    }

    if (
        fields.customer_code !== undefined &&
        (typeof fields.customer_code !== 'string' ||
            !fields.customer_code.trim() ||
            fields.customer_code.trim().length > 50)
    ) {
        errors.push('Customer code must be between 1 and 50 characters.');
    }

    if (
        fields.is_active !== undefined &&
        typeof fields.is_active !== 'boolean'
    ) {
        errors.push('is_active must be a boolean.');
    }

    return errors;
}

function parseCustomerId(value) {
    if (
        typeof value !== 'string' ||
        !/^[1-9]\d*$/.test(value) ||
        !Number.isSafeInteger(Number(value))
    ) {
        return null;
    }

    return value;
}

async function findDuplicateIdentifier(field, value, excludeId = null) {
    if (!value) return false;

    const where = { [field]: value };

    if (excludeId !== null) {
        const { Op } = require('sequelize');
        where.id = { [Op.ne]: excludeId };
    }

    return Boolean(await Customer.findOne({
        where,
        attributes: ['id'],
    }));
}

function handleDatabaseError(error, res, fallbackMessage) {
    if (
        error.name === 'SequelizeUniqueConstraintError' ||
        error.name === 'SequelizeForeignKeyConstraintError'
    ) {
        return res.status(409).json({
            message:
                error.name === 'SequelizeUniqueConstraintError'
                    ? 'A customer with one of these unique details already exists.'
                    : 'This customer is linked to other records and cannot be deleted.',
        });
    }

    console.error(fallbackMessage, error.message);

    return res.status(500).json({
        message: fallbackMessage,
    });
}

async function createCustomer(req, res) {
    try {
        const {
            customer_code,
            first_name,
            last_name,
            email,
            phone,
        } = req.body;

        if (
            typeof customer_code !== 'string' ||
            !customer_code.trim()
        ) {
            return res.status(400).json({
                message: 'Customer code is required.',
            });
        }

        const fields = {
            customer_code: customer_code.trim(),
            first_name,
            last_name,
            email: normalizeEmail(email),
            phone,
        };

        const errors = validateCustomerFields(fields, {
            creating: true,
        });

        if (errors.length) {
            return res.status(400).json({
                message: 'Invalid customer details.',
                errors,
            });
        }

        fields.first_name = first_name.trim();
        fields.last_name = last_name.trim();
        fields.phone = phone.trim();

        if (await findDuplicateIdentifier('customer_code', fields.customer_code)) {
            return res.status(409).json({
                message: 'Customer code already exists.',
            });
        }

        if (fields.email && await findDuplicateIdentifier('email', fields.email)) {
            return res.status(409).json({
                message: 'Email address is already associated with a customer.',
            });
        }

        if (await findDuplicateIdentifier('phone', fields.phone)) {
            return res.status(409).json({
                message: 'Phone number is already associated with a customer.',
            });
        }

        const customer = await Customer.create(fields);

        return res.status(201).json({
            message: 'Customer created successfully.',
            data: sanitizeCustomer(customer),
        });
    } catch (error) {
        return handleDatabaseError(
            error,
            res,
            'Unable to create customer.'
        );
    }
}

async function getCustomers(req, res) {
    try {
        const customers = await Customer.findAll({
            attributes: {
                exclude: [
                    'password_hash',
                    'email_verified_at',
                    'phone_verified_at',
                ],
            },
            include: [
                {
                    model: CustomerAddress,
                    as: 'addresses',
                },
            ],
            order: [['id', 'DESC']],
        });

        const data = customers.map((customer) => {
            const customerData = sanitizeCustomer(customer);

            return {
                ...customerData,
                mobile: customerData.phone || '',
                orders: customerData.orders || 0,
                total_spent: customerData.total_spent || 0,
                status: customerData.is_active ? 'active' : 'inactive',
            };
        });

        return res.status(200).json({
            message: 'Customers retrieved successfully.',
            data,
        });
    } catch (error) {
        return handleDatabaseError(
            error,
            res,
            'Unable to retrieve customers.'
        );
    }
}

async function getCustomer(req, res) {
    try {
        const id = parseCustomerId(req.params.id);

        if (!id) {
            return res.status(400).json({
                message: 'Invalid customer ID.',
            });
        }

        const customer = await Customer.findByPk(id, {
            attributes: {
                exclude: [
                    'password_hash',
                    'email_verified_at',
                    'phone_verified_at',
                ],
            },
            include: [
                {
                    model: CustomerAddress,
                    as: 'addresses',
                },
            ],
        });

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found.',
            });
        }

        const customerData = sanitizeCustomer(customer);

        return res.status(200).json({
            message: 'Customer retrieved successfully.',
            data: {
                ...customerData,
                mobile: customerData.phone || '',
                status: customerData.is_active ? 'active' : 'inactive',
            },
        });
    } catch (error) {
        return handleDatabaseError(
            error,
            res,
            'Unable to retrieve customer.'
        );
    }
}

async function updateCustomer(req, res) {
    try {
        const id = parseCustomerId(req.params.id);

        if (!id) {
            return res.status(400).json({
                message: 'Invalid customer ID.',
            });
        }

        const customer = await Customer.findByPk(id);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found.',
            });
        }

        const suppliedFields = Object.keys(req.body);

        const forbiddenFields = suppliedFields.filter(
            (field) =>
                !ALLOWED_UPDATE_FIELDS.includes(field)
        );

        if (forbiddenFields.length) {
            return res.status(400).json({
                message: 'Request contains unsupported fields.',
                fields: forbiddenFields,
            });
        }

        if (suppliedFields.length === 0) {
            return res.status(400).json({
                message: 'At least one field must be provided.',
            });
        }

        const updates = {};

        for (const field of suppliedFields) {
            updates[field] = req.body[field];
        }

        if (updates.first_name !== undefined) {
            updates.first_name = normalizeOptionalString(updates.first_name);
        }

        if (updates.last_name !== undefined) {
            updates.last_name = normalizeOptionalString(updates.last_name);
        }

        if (updates.phone !== undefined) {
            updates.phone = normalizeOptionalString(updates.phone);
        }

        if (updates.email !== undefined) {
            updates.email = normalizeEmail(updates.email);
        }

        const errors = validateCustomerFields(updates);

        if (errors.length) {
            return res.status(400).json({
                message: 'Invalid customer details.',
                errors,
            });
        }

        if (
            updates.email &&
            await findDuplicateIdentifier('email', updates.email, id)
        ) {
            return res.status(409).json({
                message: 'Email address is already associated with another customer.',
            });
        }

        if (
            updates.phone &&
            await findDuplicateIdentifier('phone', updates.phone, id)
        ) {
            return res.status(409).json({
                message: 'Phone number is already associated with another customer.',
            });
        }

        // Email changes must not silently retain the old verification status.
        if (
            updates.email !== undefined &&
            updates.email !== customer.email
        ) {
            updates.email_verified_at = null;
        }

        await customer.update(updates);

        return res.status(200).json({
            message: 'Customer updated successfully.',
            data: sanitizeCustomer(customer),
        });
    } catch (error) {
        return handleDatabaseError(
            error,
            res,
            'Unable to update customer.'
        );
    }
}



async function deleteCustomer(req, res) {
    const id = parseCustomerId(req.params.id);

    if (!id) {
        return res.status(400).json({
            message: 'Invalid customer ID.',
        });
    }

    try {
        const result = await sequelize.transaction(async (transaction) => {
            const customer = await Customer.findByPk(id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!customer) {
                return { notFound: true };
            }

            // Deactivate the customer without deleting their history.
            if (customer.is_active) {
                await customer.update(
                    { is_active: false },
                    { transaction }
                );
            }

            // Revoke every active session, including when the customer
            // was already inactive.
            await CustomerSession.update(
                { revoked_at: new Date() },
                {
                    where: {
                        customer_id: customer.id,
                        revoked_at: null,
                    },
                    transaction,
                }
            );

            return {
                customer,
                wasAlreadyInactive: !customer.is_active,
            };
        });

        if (result.notFound) {
            return res.status(404).json({
                message: 'Customer not found.',
            });
        }

        return res.status(200).json({
            message: 'Customer deactivated successfully.',
            data: sanitizeCustomer(result.customer),
        });
    } catch (error) {
        console.error('Customer deactivation error:', error.message);

        return res.status(500).json({
            message: 'Unable to deactivate customer.',
        });
    }
}



module.exports = {
    createCustomer,
    getCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
};
