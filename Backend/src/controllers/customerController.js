const {
    Customer,
    CustomerAddress,
    CustomerSession,
    CustomerPasswordSetupToken,
    sequelize,
} = require('../models');

const {
    createPasswordSetupInvitation,
} = require('../services/customerPasswordSetupService');

const {
    sendCustomerPasswordSetupInvitation,
} = require('../services/emailService');

const {
    CUSTOMER_TYPES,
    generateCustomerCode,
} = require('../services/customerCodeService');

const { recordAuditLog } = require('../services/auditLogService');

const ALLOWED_UPDATE_FIELDS = [
    'first_name',
    'last_name',
    'email',
    'phone',
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
    let transaction;

    try {
        const {
            first_name,
            last_name,
            email,
            phone,
        } = req.body;

        const fields = {
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

        if (
            fields.email &&
            await findDuplicateIdentifier('email', fields.email)
        ) {
            return res.status(409).json({
                message: 'Email address is already associated with a customer.',
            });
        }

        if (await findDuplicateIdentifier('phone', fields.phone)) {
            return res.status(409).json({
                message: 'Phone number is already associated with a customer.',
            });
        }

        transaction = await sequelize.transaction();

        fields.customer_code = await generateCustomerCode(
            CUSTOMER_TYPES.STAFF_CREATED.value,
            transaction
        );

        const customer = await Customer.create(fields, {
            transaction,
        });

        let invitation = null;

        if (customer.email) {
            invitation = await createPasswordSetupInvitation(
                customer.id,
                transaction
            );
        }

        const customerValues = {
            id: customer.id,
            customer_code: customer.customer_code,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            is_active: customer.is_active,
        };

        await recordAuditLog({
            userId: req.user.id,
            action: 'CUSTOMER_CREATED',
            module: 'customers',
            entityType: 'customer',
            entityId: customer.id,
            description: `Customer ${customer.customer_code} created`,
            newValues: customerValues,
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction,
        });


        await transaction.commit();

        let invitationSent = false;

        if (invitation) {
            try {
                await sendCustomerPasswordSetupInvitation(
                    invitation.email,
                    invitation.customerCode,
                    invitation.token
                );

                invitationSent = true;
            } catch (emailError) {
                console.error(
                    'Customer password invitation email failed:',
                    emailError.message
                );

                // Invalidate the unsent token. A future resend must
                // generate a fresh token.
                await CustomerPasswordSetupToken.update(
                    { used_at: new Date() },
                    {
                        where: {
                            customer_id: customer.id,
                            used_at: null,
                        },
                    }
                ).catch((cleanupError) => {
                    console.error(
                        'Failed to invalidate unsent invitation:',
                        cleanupError.message
                    );
                });
            }
        }


        return res.status(201).json({
            message: invitationSent
                ? 'Customer created successfully. Password setup invitation sent.'
                : invitation
                    ? 'Customer created, but the invitation email could not be sent.'
                    : 'Customer created successfully. No email address was provided.',
            invitation_sent: invitationSent,
            data: sanitizeCustomer(customer),
        });

    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

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
    let transaction;

    try {
        const id = parseCustomerId(req.params.id);

        if (!id) {
            return res.status(400).json({
                message: 'Invalid customer ID.',
            });
        }

        const suppliedFields = Object.keys(req.body);

        const forbiddenFields = suppliedFields.filter(
            field => !ALLOWED_UPDATE_FIELDS.includes(field)
        );

        if (forbiddenFields.length) {
            return res.status(400).json({
                message: 'Request contains unsupported fields.',
                fields: forbiddenFields,
            });
        }

        if (!suppliedFields.length) {
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

        transaction = await sequelize.transaction();

        const customer = await Customer.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!customer) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Customer not found.',
            });
        }

        if (
            updates.email &&
            await Customer.findOne({
                where: {
                    email: updates.email,
                    id: { [require('sequelize').Op.ne]: id },
                },
                attributes: ['id'],
                transaction,
            })
        ) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Email address is already associated with another customer.',
            });
        }

        if (
            updates.phone &&
            await Customer.findOne({
                where: {
                    phone: updates.phone,
                    id: { [require('sequelize').Op.ne]: id },
                },
                attributes: ['id'],
                transaction,
            })
        ) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Phone number is already associated with another customer.',
            });
        }

        const oldValues = {
            customer_code: customer.customer_code,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            is_active: customer.is_active,
        };

        // Email changes must clear verification status.
        if (
            updates.email !== undefined &&
            updates.email !== customer.email
        ) {
            updates.email_verified_at = null;
        }

        await customer.update(updates, { transaction });

        const newValues = {
            customer_code: customer.customer_code,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            is_active: customer.is_active,
        };

        const changed = Object.keys(oldValues).some(
            field => oldValues[field] !== newValues[field]
        );

        if (changed) {
            await recordAuditLog({
                userId: req.user.id,
                action: 'CUSTOMER_UPDATED',
                module: 'customers',
                entityType: 'customer',
                entityId: customer.id,
                description: `Customer ${customer.customer_code} updated`,
                oldValues,
                newValues,
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction,
            });
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Customer updated successfully.',
            data: sanitizeCustomer(customer),
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

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

    let transaction;

    try {
        transaction = await sequelize.transaction();

        const customer = await Customer.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!customer) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Customer not found.',
            });
        }

        const oldValues = {
            customer_code: customer.customer_code,
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            is_active: customer.is_active,
        };

        const wasAlreadyInactive = !customer.is_active;

        if (customer.is_active) {
            await customer.update(
                { is_active: false },
                { transaction }
            );
        }

        const [revokedSessions] = await CustomerSession.update(
            { revoked_at: new Date() },
            {
                where: {
                    customer_id: customer.id,
                    revoked_at: null,
                },
                transaction,
            }
        );

        if (!wasAlreadyInactive || revokedSessions > 0) {
            await recordAuditLog({
                userId: req.user.id,
                action: 'CUSTOMER_DEACTIVATED',
                module: 'customers',
                entityType: 'customer',
                entityId: customer.id,
                description: `Customer ${customer.customer_code} deactivated`,
                oldValues,
                newValues: {
                    ...oldValues,
                    is_active: false,
                    revoked_sessions: revokedSessions,
                },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction,
            });
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Customer deactivated successfully.',
            data: sanitizeCustomer(customer),
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        return handleDatabaseError(
            error,
            res,
            'Unable to deactivate customer.'
        );
    }
}




module.exports = {
    createCustomer,
    getCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
};
