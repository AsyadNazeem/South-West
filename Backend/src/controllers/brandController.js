
const { Brand } = require('../models');

const MAX_BRAND_ID = '18446744073709551615';

function isValidId(id) {
    if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id)) {
        return false;
    }

    if (id.length > MAX_BRAND_ID.length) {
        return false;
    }

    return (
        id.length < MAX_BRAND_ID.length ||
        id <= MAX_BRAND_ID
    );
}

function isPlainObject(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}

function validateText(value, field, maxLength, required = false) {
    if (value === undefined) {
        return required
            ? `${field} is required`
            : null;
    }

    if (typeof value !== 'string') {
        return `${field} must be a string`;
    }

    const trimmed = value.trim();

    if (required && !trimmed) {
        return `${field} is required`;
    }

    if (trimmed.length > maxLength) {
        return `${field} must not exceed ${maxLength} characters`;
    }

    return null;
}

function validateWebsite(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value !== 'string' || value.length > 255) {
        return 'Website must be a valid HTTP or HTTPS URL of at most 255 characters';
    }

    const website = value.trim();

    if (!website) {
        return null;
    }

    try {
        const url = new URL(website);

        if (
            !['http:', 'https:'].includes(url.protocol) ||
            !url.hostname ||
            url.hostname.includes(' ') ||
            url.username ||
            url.password
        ) {
            return 'Website must be a valid HTTP or HTTPS URL';
        }

        return null;
    } catch {
        return 'Website must be a valid HTTP or HTTPS URL';
    }
}

function validateActive(value) {
    return (
        typeof value === 'boolean' ||
        value === 0 ||
        value === 1
    );
}

function sendValidationError(res, message) {
    return res.status(400).json({
        success: false,
        message
    });
}

function handleControllerError(res, error, operation) {
    // Log only concise, non-request-specific error details.
    console.error(`${operation} failed:`, {
        name: error.name,
        code: error.original?.code || error.parent?.code
    });

    if (
        error.name === 'SequelizeUniqueConstraintError' ||
        error.original?.code === 'ER_DUP_ENTRY' ||
        error.parent?.code === 'ER_DUP_ENTRY'
    ) {
        return res.status(409).json({
            success: false,
            message: 'Brand name or code already exists'
        });
    }

    if (
        error.name === 'SequelizeValidationError' ||
        error.name === 'SequelizeDatabaseError' &&
        error.original?.code === 'ER_DATA_TOO_LONG'
    ) {
        return res.status(400).json({
            success: false,
            message: 'Invalid brand data'
        });
    }

    return res.status(500).json({
        success: false,
        message: 'An internal server error occurred'
    });
}

// GET ALL BRANDS
const getBrands = async (req, res) => {
    try {
        const brands = await Brand.findAll({
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            success: true,
            message: 'Brands retrieved successfully',
            data: brands
        });
    } catch (error) {
        return handleControllerError(res, error, 'Get brands');
    }
};

// GET BRAND BY ID
const getBrandById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return sendValidationError(res, 'Invalid brand ID');
        }

        const brand = await Brand.findByPk(id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Brand retrieved successfully',
            data: brand
        });
    } catch (error) {
        return handleControllerError(res, error, 'Get brand');
    }
};

// CREATE BRAND
const createBrand = async (req, res) => {
    try {
        if (!isPlainObject(req.body)) {
            return sendValidationError(res, 'Request body must be a JSON object');
        }

        const { name, code, description, website } = req.body;

        const nameError = validateText(name, 'Brand name', 100, true);
        if (nameError) return sendValidationError(res, nameError);

        const codeError = validateText(code, 'Brand code', 50, true);
        if (codeError) return sendValidationError(res, codeError);

        const descriptionError = validateText(description, 'Description', 65535);
        if (descriptionError) {
            return sendValidationError(res, descriptionError);
        }

        if (
            description !== undefined &&
            Buffer.byteLength(description, 'utf8') > 65535
        ) {
            return sendValidationError(res, 'Description is too long');
        }

        const websiteError = validateWebsite(website);
        if (websiteError) {
            return sendValidationError(res, websiteError);
        }

        const normalizedName = name.trim();
        const normalizedCode = code.trim();
        const normalizedWebsite =
            typeof website === 'string' && website.trim()
                ? website.trim()
                : null;

        const existingName = await Brand.findOne({
            where: { name: normalizedName }
        });

        if (existingName) {
            return res.status(409).json({
                success: false,
                message: 'Brand name already exists'
            });
        }

        const existingCode = await Brand.findOne({
            where: { code: normalizedCode }
        });

        if (existingCode) {
            return res.status(409).json({
                success: false,
                message: 'Brand code already exists'
            });
        }

        const brand = await Brand.create({
            name: normalizedName,
            code: normalizedCode,
            description:
                description === undefined ? null : description,
            website: normalizedWebsite,
            is_active: true
        });

        return res.status(201).json({
            success: true,
            message: 'Brand created successfully',
            data: brand
        });
    } catch (error) {
        return handleControllerError(res, error, 'Create brand');
    }
};

// UPDATE BRAND
const updateBrand = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return sendValidationError(res, 'Invalid brand ID');
        }

        if (!isPlainObject(req.body)) {
            return sendValidationError(res, 'Request body must be a JSON object');
        }

        const {
            name,
            code,
            description,
            website,
            is_active
        } = req.body;

        const allowedFields = [
            'name',
            'code',
            'description',
            'website',
            'is_active'
        ];

        const unexpectedFields = Object.keys(req.body).filter(
            field => !allowedFields.includes(field)
        );

        if (unexpectedFields.length > 0) {
            return sendValidationError(
                res,
                `Unsupported field: ${unexpectedFields[0]}`
            );
        }

        if (Object.keys(req.body).length === 0) {
            return sendValidationError(res, 'Provide at least one field to update');
        }

        const brand = await Brand.findByPk(req.params.id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found'
            });
        }

        if (name !== undefined) {
            const error = validateText(name, 'Brand name', 100, true);
            if (error) return sendValidationError(res, error);
        }

        if (code !== undefined) {
            const error = validateText(code, 'Brand code', 50, true);
            if (error) return sendValidationError(res, error);
        }

        if (description !== undefined) {
            const error = validateText(description, 'Description', 65535);
            if (error) return sendValidationError(res, error);

            if (Buffer.byteLength(description, 'utf8') > 65535) {
                return sendValidationError(res, 'Description is too long');
            }
        }

        if (website !== undefined) {
            const error = validateWebsite(website);
            if (error) return sendValidationError(res, error);
        }

        if (is_active !== undefined && !validateActive(is_active)) {
            return sendValidationError(
                res,
                'is_active must be true, false, 1, or 0'
            );
        }

        const normalizedName =
            name === undefined ? brand.name : name.trim();

        const normalizedCode =
            code === undefined ? brand.code : code.trim();

        if (name !== undefined && normalizedName !== brand.name) {
            const existingName = await Brand.findOne({
                where: { name: normalizedName }
            });

            if (existingName && String(existingName.id) !== String(brand.id)) {
                return res.status(409).json({
                    success: false,
                    message: 'Brand name already exists'
                });
            }
        }

        if (code !== undefined && normalizedCode !== brand.code) {
            const existingCode = await Brand.findOne({
                where: { code: normalizedCode }
            });

            if (existingCode && String(existingCode.id) !== String(brand.id)) {
                return res.status(409).json({
                    success: false,
                    message: 'Brand code already exists'
                });
            }
        }

        const updates = {};

        if (name !== undefined) updates.name = normalizedName;
        if (code !== undefined) updates.code = normalizedCode;
        if (description !== undefined) updates.description = description;
        if (website !== undefined) {
            updates.website =
                typeof website === 'string' && website.trim()
                    ? website.trim()
                    : null;
        }
        if (is_active !== undefined) {
            updates.is_active = is_active === true || is_active === 1;
        }

        await brand.update(updates);

        return res.status(200).json({
            success: true,
            message: 'Brand updated successfully',
            data: brand
        });
    } catch (error) {
        return handleControllerError(res, error, 'Update brand');
    }
};

// DEACTIVATE BRAND (SOFT DELETE)
const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return sendValidationError(res, 'Invalid brand ID');
        }

        const brand = await Brand.findByPk(id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found'
            });
        }

        if (!brand.is_active) {
            return res.status(409).json({
                success: false,
                message: 'Brand is already deactivated'
            });
        }

        await brand.update({ is_active: false });

        return res.status(200).json({
            success: true,
            message: 'Brand deactivated successfully'
        });
    } catch (error) {
        return handleControllerError(res, error, 'Deactivate brand');
    }
};

module.exports = {
    getBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand
};
