'use strict';

const { Brand, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { removeStoredImage } = require('../utils/fileStorage');

const MAX_BRAND_ID = '18446744073709551615';
const MAX_DESCRIPTION_BYTES = 65535;

// =========================================================
// VALIDATION HELPERS
// =========================================================

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
        return required ? `${field} is required` : null;
    }

    if (value === null && !required) {
        return null;
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

function normalizeActive(value) {
    if (
        value === true ||
        value === 1 ||
        value === '1' ||
        value === 'true'
    ) {
        return true;
    }

    if (
        value === false ||
        value === 0 ||
        value === '0' ||
        value === 'false'
    ) {
        return false;
    }

    return null;
}

function sendValidationError(res, message) {
    return res.status(400).json({
        success: false,
        message,
    });
}

function handleControllerError(res, error, operation) {
    console.error(`${operation} failed:`, {
        name: error.name,
        code: error.original?.code || error.parent?.code,
    });

    if (
        error.name === 'SequelizeUniqueConstraintError' ||
        error.original?.code === 'ER_DUP_ENTRY' ||
        error.parent?.code === 'ER_DUP_ENTRY'
    ) {
        return res.status(409).json({
            success: false,
            message: 'Brand name or code already exists',
        });
    }

    if (
        error.name === 'SequelizeValidationError' ||
        (
            error.name === 'SequelizeDatabaseError' &&
            error.original?.code === 'ER_DATA_TOO_LONG'
        )
    ) {
        return res.status(400).json({
            success: false,
            message: 'Invalid brand data',
        });
    }

    return res.status(500).json({
        success: false,
        message: 'An internal server error occurred',
    });
}

// =========================================================
// UPLOAD CLEANUP HELPERS
// =========================================================

// Best-effort cleanup. Never let a cleanup failure turn a
// successful database operation into an apparent failure.
async function cleanupStoredFile(filePath) {
    if (!filePath) return;

    try {
        const result = await removeStoredImage(filePath);
        if (result.status === 'failed') {
            console.error('Brand image cleanup requires follow-up.');
        }
    } catch (error) {
        console.error('Brand image cleanup failed:', {
            code: error.code,
            name: error.name,
        });
    }
}

// =========================================================
// GET ALL BRANDS
// =========================================================

const getBrands = async (req, res) => {
    try {
        const brands = await Brand.findAll({
            order: [['id', 'DESC']],
        });

        return res.status(200).json({
            success: true,
            message: 'Brands retrieved successfully',
            data: brands,
        });
    } catch (error) {
        return handleControllerError(res, error, 'Get brands');
    }
};

// =========================================================
// GET BRAND BY ID
// =========================================================

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
                message: 'Brand not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Brand retrieved successfully',
            data: brand,
        });
    } catch (error) {
        return handleControllerError(res, error, 'Get brand');
    }
};

// =========================================================
// CREATE BRAND
// =========================================================

const createBrand = async (req, res) => {
    let createdBrand = null;

    try {
        if (!isPlainObject(req.body)) {
            return sendValidationError(
                res,
                'Request body must be an object'
            );
        }

const { name, description, website } = req.body;

        const nameError = validateText(name, 'Brand name', 100, true);
        if (nameError) return sendValidationError(res, nameError);

        const descriptionError = validateText(
            description,
            'Description',
            MAX_DESCRIPTION_BYTES
        );
        if (descriptionError) {
            return sendValidationError(res, descriptionError);
        }

        if (
            typeof description === 'string' &&
            Buffer.byteLength(description, 'utf8') > MAX_DESCRIPTION_BYTES
        ) {
            return sendValidationError(res, 'Description is too long');
        }

        const websiteError = validateWebsite(website);
        if (websiteError) {
            return sendValidationError(res, websiteError);
        }

        const normalizedName = name.trim();
        const normalizedWebsite =
            typeof website === 'string' && website.trim()
                ? website.trim()
                : null;

        const existingName = await Brand.findOne({
            where: { name: normalizedName },
        });

        if (existingName) {
            return res.status(409).json({
                success: false,
                message: 'Brand name already exists',
            });
        }

createdBrand = await sequelize.transaction(async transaction => {
    const sequences = await sequelize.query(
        `SELECT next_value
         FROM brand_code_sequences
         WHERE id = 1
         FOR UPDATE`,
        {
            type: QueryTypes.SELECT,
            transaction,
        }
    );

    if (!sequences.length) {
        throw new Error('Brand code sequence is not initialized');
    }

    const nextValue = Number(sequences[0].next_value);

    if (!Number.isSafeInteger(nextValue) || nextValue < 1) {
        throw new Error('Brand code sequence value is invalid');
    }

    const generatedCode = `BR-${String(nextValue).padStart(4, '0')}`;

    await sequelize.query(
        `UPDATE brand_code_sequences
         SET next_value = next_value + 1
         WHERE id = 1`,
        { transaction }
    );

    return Brand.create(
        {
            name: normalizedName,
            code: generatedCode,
            description:
                typeof description === 'string' && description.trim()
                    ? description.trim()
                    : null,
            website: normalizedWebsite,
            image_url: req.file ? req.file.relativePath : null,
            is_active: true,
        },
        { transaction }
    );
});

        return res.status(201).json({
            success: true,
            message: 'Brand created successfully',
            data: createdBrand,
        });
    } catch (error) {
        // If creation failed after an image was uploaded, remove it.
        if (!createdBrand && req.file?.relativePath) {
            await cleanupStoredFile(req.file.relativePath);
        }

        return handleControllerError(res, error, 'Create brand');
    }
};

// =========================================================
// UPDATE BRAND
// =========================================================

const updateBrand = async (req, res) => {
    let brand = null;
    let previousImagePath = null;
    let imageWasReplaced = false;

    try {
        if (!isValidId(req.params.id)) {
            return sendValidationError(res, 'Invalid brand ID');
        }

        if (!isPlainObject(req.body)) {
            return sendValidationError(
                res,
                'Request body must be an object'
            );
        }

        const {
            name,
            code,
            description,
            website,
            is_active,
        } = req.body;

        // Image paths are server-managed. Clients can upload a file,
        // but cannot choose an arbitrary stored image path.
        const allowedFields = [
            'name',
            'code',
            'description',
            'website',
            'is_active',
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

        if (Object.keys(req.body).length === 0 && !req.file) {
            return sendValidationError(
                res,
                'Provide at least one field to update'
            );
        }

        brand = await Brand.findByPk(req.params.id);

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found',
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
            const error = validateText(
                description,
                'Description',
                MAX_DESCRIPTION_BYTES
            );
            if (error) return sendValidationError(res, error);

            if (
                typeof description === 'string' &&
                Buffer.byteLength(description, 'utf8') > MAX_DESCRIPTION_BYTES
            ) {
                return sendValidationError(res, 'Description is too long');
            }
        }

        if (website !== undefined) {
            const error = validateWebsite(website);
            if (error) return sendValidationError(res, error);
        }

        const normalizedActive =
            is_active === undefined ? undefined : normalizeActive(is_active);

        if (is_active !== undefined && normalizedActive === null) {
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
                where: { name: normalizedName },
            });

            if (
                existingName &&
                String(existingName.id) !== String(brand.id)
            ) {
                return res.status(409).json({
                    success: false,
                    message: 'Brand name already exists',
                });
            }
        }

        if (code !== undefined && normalizedCode !== brand.code) {
            const existingCode = await Brand.findOne({
                where: { code: normalizedCode },
            });

            if (
                existingCode &&
                String(existingCode.id) !== String(brand.id)
            ) {
                return res.status(409).json({
                    success: false,
                    message: 'Brand code already exists',
                });
            }
        }

        const updates = {};

        if (name !== undefined) {
            updates.name = normalizedName;
        }

        if (code !== undefined) {
            updates.code = normalizedCode;
        }

        if (description !== undefined) {
            updates.description =
                typeof description === 'string' && description.trim()
                    ? description.trim()
                    : null;
        }

        if (website !== undefined) {
            updates.website =
                typeof website === 'string' && website.trim()
                    ? website.trim()
                    : null;
        }

        if (is_active !== undefined) {
            updates.is_active = normalizedActive;
        }

        if (req.file) {
            previousImagePath = brand.image_url;
            updates.image_url = req.file.relativePath;
            imageWasReplaced = true;
        }

        await brand.update(updates);

        // Only remove the old image after the database update succeeds.
        if (
            imageWasReplaced &&
            previousImagePath &&
            previousImagePath !== req.file.relativePath
        ) {
            await cleanupStoredFile(previousImagePath);
        }

        return res.status(200).json({
            success: true,
            message: 'Brand updated successfully',
            data: brand,
        });
    } catch (error) {
        // The database update failed, so the newly uploaded image is
        // not being used. Preserve the existing image.
        if (req.file?.relativePath && !imageWasReplaced) {
            await cleanupStoredFile(req.file.relativePath);
        }

        return handleControllerError(res, error, 'Update brand');
    }
};

// =========================================================
// DEACTIVATE BRAND (SOFT DELETE)
// =========================================================

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
                message: 'Brand not found',
            });
        }

        if (!brand.is_active) {
            return res.status(409).json({
                success: false,
                message: 'Brand is already deactivated',
            });
        }

        await brand.update({ is_active: false });

        return res.status(200).json({
            success: true,
            message: 'Brand deactivated successfully',
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
    deleteBrand,
};
