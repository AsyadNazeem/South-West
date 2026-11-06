const { Op } = require('sequelize');
const {
    Customer,
    CustomerAddress,
    DeliveryDistrict,
    DeliveryArea,
    sequelize
} = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const ADDRESS_FIELDS = [
    'address_type',
    'recipient_name',
    'phone',
    'address_line_1',
    'address_line_2',
    'district_id',
    'area_id',
    'city',
    'state',
    'postal_code',
    'country',
    'is_default'
];

const REQUIRED_FIELDS = [
    'recipient_name',
    'phone',
    'address_line_1',
    'city',
    'district_id',
    'area_id'
];


async function auditCustomerAddressAction({
                                              req,
                                              action,
                                              customerId = null,
                                              addressId = null,
                                              description,
                                              oldValues = null,
                                              newValues = null
                                          }) {
    try {
        await recordAuditLog({
            userId: req.user?.id ?? req.user?.user_id ?? null,
            action,
            module: 'CUSTOMER_ADDRESS',
            entityType: 'CustomerAddress',
            entityId: addressId,
            description,
            oldValues,
            newValues: {
                ...(newValues || {}),
                ...(customerId !== null
                    ? { customer_id: customerId }
                    : {})
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestId: req.id
        });
    } catch (error) {
        console.error(
            'Customer address audit logging failed:',
            error.message
        );
    }
}

function addressAuditValues(address) {
    if (!address) return null;

    return {
        address_type: address.address_type,
        recipient_name: address.recipient_name,
        phone: address.phone,
        address_line_1: address.address_line_1,
        address_line_2: address.address_line_2,
        district_id: address.district_id,
        area_id: address.area_id,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
        country: address.country,
        is_default: address.is_default
    };
}




function validId(value) {
    return (
        (typeof value === 'string' || typeof value === 'number') &&
        /^\d+$/.test(String(value)) &&
        BigInt(String(value)) > 0n &&
        BigInt(String(value)) <= 18446744073709551615n
    );
}

function getCustomerId(req) {
    // Customer identity comes from verified customer authentication.
    // Admin identity is supplied by the protected admin route.
    return req.customer
        ? req.customer.id
        : req.params.customerId;
}

function validatePayload(body, partial = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'A valid address object is required.';
    }

    const unknownFields = Object.keys(body).filter(
        key => !ADDRESS_FIELDS.includes(key)
    );

    if (unknownFields.length) {
        return `Unsupported address field: ${unknownFields[0]}`;
    }

    if (!partial) {
        for (const field of REQUIRED_FIELDS) {
            if (
                body[field] === undefined ||
                body[field] === null ||
                (typeof body[field] === 'string' && !body[field].trim())
            ) {
                return `${field} is required.`;
            }
        }
    }

    for (const field of [
        'recipient_name',
        'phone',
        'address_line_1',
        'address_line_2',
        'city',
        'state',
        'postal_code',
        'country',
        'address_type'
    ]) {
        if (
            body[field] !== undefined &&
            body[field] !== null &&
            typeof body[field] !== 'string'
        ) {
            return `${field} must be a string.`;
        }
    }

    const limits = {
        address_type: 30,
        recipient_name: 200,
        phone: 30,
        address_line_1: 255,
        address_line_2: 255,
        city: 100,
        state: 100,
        postal_code: 20,
        country: 100
    };

    for (const [field, max] of Object.entries(limits)) {
        if (
            typeof body[field] === 'string' &&
            body[field].length > max
        ) {
            return `${field} cannot exceed ${max} characters.`;
        }
    }

    if (
        body.address_type !== undefined &&
        !['shipping', 'billing'].includes(
            body.address_type.trim().toLowerCase()
        )
    ) {
        return 'address_type must be shipping or billing.';
    }

    for (const field of ['district_id', 'area_id']) {
        if (
            body[field] !== undefined &&
            !validId(body[field])
        ) {
            return `${field} must be a valid positive ID.`;
        }
    }

    if (
        body.is_default !== undefined &&
        typeof body.is_default !== 'boolean'
    ) {
        return 'is_default must be true or false.';
    }

    return null;
}

function normalisePayload(body) {
    const result = {};

    for (const field of ADDRESS_FIELDS) {
        if (body[field] !== undefined) {
            result[field] =
                typeof body[field] === 'string'
                    ? body[field].trim()
                    : body[field];
        }
    }

    if (result.address_type !== undefined) {
        result.address_type = result.address_type.toLowerCase();
    }

    return result;
}

async function validateDeliveryLocation(
    districtId,
    areaId,
    transaction
) {
    const district = await DeliveryDistrict.findOne({
        where: {
            id: districtId,
            status: 1
        },
        transaction
    });

    if (!district) {
        return {
            error: 'Selected district does not exist or is inactive.'
        };
    }

    const area = await DeliveryArea.findOne({
        where: {
            id: areaId,
            district_id: districtId,
            status: 1
        },
        transaction
    });

    if (!area) {
        return {
            error:
                'Selected delivery area does not exist, is inactive, or does not belong to the selected district.'
        };
    }

    return {};
}

function handleError(res, label, error) {
    console.error(`${label}:`, error.message);

    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
            message: 'Address validation failed.'
        });
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
            message: 'The selected customer or delivery location is invalid.'
        });
    }

    if (
        error.name === 'SequelizeUniqueConstraintError' ||
        error.original?.code === 'ER_DUP_ENTRY'
    ) {
        return res.status(409).json({
            message: 'This change conflicts with an existing default address. Please refresh and try again.'
        });
    }

    return res.status(500).json({
        message: 'Unable to process customer address.'
    });
}

async function createAddress(req, res) {
    const validationError = validatePayload(req.body);

    if (validationError) {
        return res.status(400).json({message: validationError});
    }

    const customerId = getCustomerId(req);

    if (!validId(customerId)) {
        return res.status(400).json({
            message: 'A valid customer ID is required.'
        });
    }

    const payload = normalisePayload(req.body);

    try {
        if (!req.customer) {
            const customer = await Customer.findByPk(customerId);

            if (!customer) {
                return res.status(404).json({
                    message: 'Customer not found.'
                });
            }
        }

        const address = await sequelize.transaction(async transaction => {
            const customer = await Customer.findByPk(customerId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!customer) {
                const error = new Error('Customer not found.');
                error.statusCode = 404;
                throw error;
            }

            const addressCount = await CustomerAddress.count({
                where: {customer_id: customerId},
                transaction
            });

            if (addressCount >= 3) {
                const error = new Error(
                    'You can save a maximum of 3 addresses.'
                );
                error.statusCode = 400;
                throw error;
            }

            const location = await validateDeliveryLocation(
                payload.district_id,
                payload.area_id,
                transaction
            );

            if (location.error) {
                const error = new Error(location.error);
                error.statusCode = 400;
                throw error;
            }

            if (payload.is_default === true) {
                await CustomerAddress.update(
                    {is_default: false},
                    {
                        where: {customer_id: customerId},
                        transaction
                    }
                );
            }

            return CustomerAddress.create(
                {
                    ...payload,
                    customer_id: customerId,
                    address_type: payload.address_type || 'shipping',
                    country: payload.country || 'Sri Lanka',
                    is_default: payload.is_default === true
                },
                {transaction}
            );
        });

        await auditCustomerAddressAction({
            req,
            action: 'CUSTOMER_ADDRESS_CREATED',
            customerId,
            addressId: address.id,
            description: 'Customer address created successfully',
            newValues: addressAuditValues(address)
        });

        return res.status(201).json({
            message: 'Customer address created successfully.',
            data: address
        });
    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({message: error.message});
        }

        return handleError(res, 'Create address error', error);
    }
}

async function getAddresses(req, res) {
    const customerId = getCustomerId(req);

    if (!validId(customerId)) {
        return res.status(400).json({
            message: 'A valid customer ID is required.'
        });
    }

    try {
        if (!req.customer) {
            const customer = await Customer.findByPk(customerId);

            if (!customer) {
                return res.status(404).json({
                    message: 'Customer not found.'
                });
            }
        }

        const addresses = await CustomerAddress.findAll({
            where: {customer_id: customerId},
            order: [
                ['is_default', 'DESC'],
                ['id', 'DESC']
            ]
        });

        return res.status(200).json({
            message: 'Customer addresses retrieved successfully.',
            data: addresses
        });
    } catch (error) {
        return handleError(res, 'Get addresses error', error);
    }
}

async function updateAddress(req, res) {
    const customerId = getCustomerId(req);
    const {addressId} = req.params;

    if (!validId(customerId) || !validId(addressId)) {
        return res.status(400).json({
            message: 'Valid customer and address IDs are required.'
        });
    }

    const validationError = validatePayload(req.body, true);

    if (validationError) {
        return res.status(400).json({message: validationError});
    }

    if (!Object.keys(req.body || {}).length) {
        return res.status(400).json({
            message: 'Provide at least one field to update.'
        });
    }

    const payload = normalisePayload(req.body);

    try {
        const updatedAddress = await sequelize.transaction(async transaction => {
            // Lock the customer row to serialize address changes per customer.
            const customer = await Customer.findByPk(customerId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!customer) {
                const error = new Error('Customer not found.');
                error.statusCode = 404;
                throw error;
            }

            const address = await CustomerAddress.findOne({
                where: {
                    id: addressId,
                    customer_id: customerId
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!address) {
                const error = new Error('Customer address not found.');
                error.statusCode = 404;
                throw error;
            }

            const districtId =
                payload.district_id !== undefined
                    ? payload.district_id
                    : address.district_id;

            const areaId =
                payload.area_id !== undefined
                    ? payload.area_id
                    : address.area_id;

            if (
                payload.district_id !== undefined ||
                payload.area_id !== undefined
            ) {
                const location = await validateDeliveryLocation(
                    districtId,
                    areaId,
                    transaction
                );

                if (location.error) {
                    const error = new Error(location.error);
                    error.statusCode = 400;
                    throw error;
                }
            }

            if (payload.is_default === true) {
                await CustomerAddress.update(
                    {is_default: false},
                    {
                        where: {
                            customer_id: customerId,
                            id: {[require('sequelize').Op.ne]: addressId}
                        },
                        transaction
                    }
                );
            }


            const oldValues = addressAuditValues(address);

            await address.update(payload, { transaction });

            await auditCustomerAddressAction({
                req,
                action: 'CUSTOMER_ADDRESS_UPDATED',
                customerId,
                addressId: address.id,
                description: 'Customer address updated successfully',
                oldValues,
                newValues: addressAuditValues(address)
            });

            return address;

        });


        return res.status(200).json({
            message: 'Customer address updated successfully.',
            data: updatedAddress
        });
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({message: error.message});
        }

        if (error.statusCode === 400) {
            return res.status(400).json({message: error.message});
        }

        return handleError(res, 'Update address error', error);
    }
}

async function deleteAddress(req, res) {
    const customerId = getCustomerId(req);
    const {addressId} = req.params;

    if (!validId(customerId) || !validId(addressId)) {
        return res.status(400).json({
            message: 'Valid customer and address IDs are required.'
        });
    }

    try {
        const address = await CustomerAddress.findOne({
            where: {
                id: addressId,
                customer_id: customerId
            }
        });

        if (!address) {
            return res.status(404).json({
                message: 'Customer address not found.'
            });
        }

        const oldValues = addressAuditValues(address);
        await address.destroy();

        await auditCustomerAddressAction({
            req,
            action: 'CUSTOMER_ADDRESS_DELETED',
            customerId,
            addressId: address.id,
            description: 'Customer address deleted successfully',
            oldValues
        });

        return res.status(200).json({
            message: 'Customer address deleted successfully.'
        });
    } catch (error) {
        return handleError(res, 'Delete address error', error);
    }
}

async function getAddressById(req, res) {
    const {addressId} = req.params;

    if (!validId(addressId)) {
        return res.status(400).json({
            message: 'A valid address ID is required.'
        });
    }

    try {
        const where = {id: addressId};

        if (req.customer) {
            where.customer_id = req.customer.id;
        }

        const address = await CustomerAddress.findOne({where});

        if (!address) {
            return res.status(404).json({
                message: 'Customer address not found.'
            });
        }

        return res.status(200).json({
            message: 'Customer address retrieved successfully.',
            data: address
        });
    } catch (error) {
        return handleError(res, 'Get address by ID error', error);
    }
}

async function getAllAddresses(req, res) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (req.query.type) where.address_type = req.query.type;
        if (search) where[Op.or] = [
            ...['recipient_name', 'city', 'postal_code', 'phone'].map(field => ({ [field]: { [Op.like]: `%${search}%` } })),
            { '$customer.first_name$': { [Op.like]: `%${search}%` } },
            { '$customer.last_name$': { [Op.like]: `%${search}%` } },
        ];
        const result = await CustomerAddress.findAndCountAll({
            where,
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['id', 'first_name', 'last_name']
            }],
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const addresses = result.rows;

        const data = addresses.map(address => {
            const row = address.toJSON();
            const type = (row.address_type || '').toLowerCase();

            return {
                ...row,
                customer_name: row.customer
                    ? `${row.customer.first_name} ${row.customer.last_name}`.trim()
                    : 'Guest',
                province: row.state || '',
                is_default_shipping:
                    Boolean(row.is_default) && type === 'shipping',
                is_default_billing:
                    Boolean(row.is_default) && type === 'billing'
            };
        });

        return res.status(200).json({
            message: 'Customer addresses retrieved successfully.',
            data,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });
    } catch (error) {
        return handleError(res, 'Get all addresses error', error);
    }
}

async function deleteAddressById(req, res) {
    const {addressId} = req.params;

    if (!validId(addressId)) {
        return res.status(400).json({
            message: 'A valid address ID is required.'
        });
    }

    try {
        const address = await CustomerAddress.findByPk(addressId);

        if (!address) {
            return res.status(404).json({
                message: 'Customer address not found.'
            });
        }

        await address.destroy();

        return res.status(200).json({
            message: 'Customer address deleted successfully.'
        });
    } catch (error) {
        return handleError(res, 'Delete address by ID error', error);
    }
}

module.exports = {
    createAddress,
    getAddresses,
    getAddressById,
    getAllAddresses,
    updateAddress,
    deleteAddress,
    deleteAddressById
};
