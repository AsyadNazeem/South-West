
const { Op } = require('sequelize');
const { Supplier, sequelize } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const EDITABLE_FIELDS = [
    'supplier_code',
    'company_name',
    'contact_person',
    'email',
    'phone',
    'address_line_1',
    'address_line_2',
    'city',
    'state',
    'postal_code',
    'country',
    'tax_number',
    'payment_terms',
    'notes'
];

const STRING_LIMITS = {
    supplier_code: 50,
    company_name: 150,
    contact_person: 150,
    email: 150,
    phone: 50,
    address_line_1: 255,
    address_line_2: 255,
    city: 100,
    state: 100,
    postal_code: 20,
    country: 100,
    tax_number: 100,
    payment_terms: 100
};

const getRequestMetadata = (req) => ({
    userId: req.user.id,
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null
});

const validateSupplierFields = (data, { creating = false } = {}) => {
    const errors = {};

    if (creating && !String(data.supplier_code ?? '').trim()) {
        errors.supplier_code = 'Supplier code is required';
    }

    if (creating && !String(data.company_name ?? '').trim()) {
        errors.company_name = 'Company name is required';
    }

    for (const field of EDITABLE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(data, field)) {
            continue;
        }

        const value = data[field];

        if (value === null) {
            continue;
        }

        if (typeof value !== 'string') {
            errors[field] = `${field} must be a string or null`;
            continue;
        }

        if (field !== 'notes' && value.length > (STRING_LIMITS[field] ?? Infinity)) {
            errors[field] = `${field} exceeds the maximum allowed length`;
        }

        if (
            (field === 'supplier_code' || field === 'company_name') &&
            !value.trim()
        ) {
            errors[field] = `${field} cannot be empty`;
        }

        if (
            field === 'email' &&
            value.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
        ) {
            errors.email = 'Email address is invalid';
        }
    }

    return errors;
};

const getEditableValues = (body) =>
    Object.fromEntries(
        EDITABLE_FIELDS
            .filter(field =>
                Object.prototype.hasOwnProperty.call(body, field)
            )
            .map(field => [field, body[field]])
    );

const normalizeSupplierCode = (value) =>
    typeof value === 'string' ? value.trim() : value;

const handleSupplierError = (error, res, operation) => {
    if (
        error.name === 'SequelizeUniqueConstraintError' ||
        error.original?.code === 'ER_DUP_ENTRY'
    ) {
        return res.status(409).json({
            message: 'Supplier code already exists'
        });
    }

    if (
        error.name === 'SequelizeValidationError' ||
        error.name === 'SequelizeDatabaseError' &&
        error.original?.code === 'ER_DATA_TOO_LONG'
    ) {
        return res.status(400).json({
            message: 'Supplier data is invalid'
        });
    }

    console.error(`${operation} supplier error:`, error);

    return res.status(500).json({
        message: `Failed to ${operation} supplier`
    });
};

// GET ALL SUPPLIERS
const getSuppliers = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = ['supplier_code', 'company_name', 'contact_person', 'email', 'phone'].map(field => ({ [field]: { [Op.like]: `%${search}%` } }));
        if (req.query.status === 'active') where.is_active = true;
        if (req.query.status === 'inactive') where.is_active = false;
        const result = await Supplier.findAndCountAll({
            where,
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined
        });
        const suppliers = result.rows;

        return res.status(200).json({
            message: 'Suppliers retrieved successfully',
            data: suppliers,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });
    } catch (error) {
        return handleSupplierError(error, res, 'retrieve');
    }
};

// GET SUPPLIER BY ID
const getSupplierById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            return res.status(400).json({
                message: 'Invalid supplier ID'
            });
        }

        const supplier = await Supplier.findByPk(id);

        if (!supplier) {
            return res.status(404).json({
                message: 'Supplier not found'
            });
        }

        return res.status(200).json({
            message: 'Supplier retrieved successfully',
            data: supplier
        });
    } catch (error) {
        return handleSupplierError(error, res, 'retrieve');
    }
};

// CREATE SUPPLIER
const createSupplier = async (req, res) => {
    let transaction;

    try {
        const values = getEditableValues(req.body);
        const errors = validateSupplierFields(values, { creating: true });

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Supplier validation failed',
                errors
            });
        }

        values.supplier_code = normalizeSupplierCode(values.supplier_code);
        values.company_name = values.company_name.trim();

        if (values.email) {
            values.email = values.email.trim();
        }

        transaction = await sequelize.transaction();

        const supplier = await Supplier.create(values, { transaction });

        await recordAuditLog({
            ...getRequestMetadata(req),
            action: 'SUPPLIER_CREATED',
            module: 'suppliers',
            entityType: 'supplier',
            entityId: supplier.id,
            description: `Supplier ${supplier.supplier_code} created`,
            newValues: supplier.toJSON(),
            transaction
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Supplier created successfully',
            data: supplier
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        return handleSupplierError(error, res, 'create');
    }
};

// UPDATE SUPPLIER
const updateSupplier = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            return res.status(400).json({
                message: 'Invalid supplier ID'
            });
        }

        const values = getEditableValues(req.body);

        if (!Object.keys(values).length) {
            return res.status(400).json({
                message: 'No editable supplier fields supplied'
            });
        }

        const errors = validateSupplierFields(values);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Supplier validation failed',
                errors
            });
        }

        if (Object.prototype.hasOwnProperty.call(values, 'supplier_code')) {
            values.supplier_code = normalizeSupplierCode(values.supplier_code);
        }

        if (
            typeof values.company_name === 'string'
        ) {
            values.company_name = values.company_name.trim();
        }

        if (typeof values.email === 'string') {
            values.email = values.email.trim();
        }

        transaction = await sequelize.transaction();

        const supplier = await Supplier.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!supplier) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Supplier not found'
            });
        }

        const oldValues = supplier.toJSON();

        await supplier.update(values, { transaction });

        const newValues = supplier.toJSON();

        const changed = Object.keys(values).some(
            field => oldValues[field] !== newValues[field]
        );

        if (changed) {
            await recordAuditLog({
                ...getRequestMetadata(req),
                action: 'SUPPLIER_UPDATED',
                module: 'suppliers',
                entityType: 'supplier',
                entityId: supplier.id,
                description: `Supplier ${supplier.supplier_code} updated`,
                oldValues,
                newValues,
                transaction
            });
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Supplier updated successfully',
            data: supplier
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        return handleSupplierError(error, res, 'update');
    }
};

// DEACTIVATE SUPPLIER
const deleteSupplier = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            return res.status(400).json({
                message: 'Invalid supplier ID'
            });
        }

        transaction = await sequelize.transaction();

        const supplier = await Supplier.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!supplier) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Supplier not found'
            });
        }

        if (!supplier.is_active) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Supplier is already inactive'
            });
        }

        const oldValues = supplier.toJSON();

        await supplier.update(
            { is_active: false },
            { transaction }
        );

        await recordAuditLog({
            ...getRequestMetadata(req),
            action: 'SUPPLIER_DEACTIVATED',
            module: 'suppliers',
            entityType: 'supplier',
            entityId: supplier.id,
            description: `Supplier ${supplier.supplier_code} deactivated`,
            oldValues,
            newValues: supplier.toJSON(),
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Supplier deactivated successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        return handleSupplierError(error, res, 'deactivate');
    }
};

module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier
};
