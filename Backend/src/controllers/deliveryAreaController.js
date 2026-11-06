const {
    Op,
    DeliveryArea,
    DeliveryDistrict
} = require("../models")
const { recordAuditLog } = require('../services/auditLogService');

async function auditDeliveryAction(req, {
    action,
    entityId = null,
    description,
    newValues = null
}) {
    try {
        await recordAuditLog({
            userId: req.user?.id ?? req.user?.user_id ?? null,
            action,
            module: 'DELIVERY',
            entityType: 'DeliveryArea',
            entityId: entityId == null ? null : String(entityId),
            description,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get?.('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (error) {
        console.error('Delivery audit logging failed:', error.message);
    }
}


// =====================================================
// GET DELIVERY AREAS
//
// GET /delivery-areas
// Returns all delivery areas.
//
// GET /delivery-areas?district_id=1
// Returns delivery areas for a specific district.
// =====================================================

const getDeliveryAreas = async (req, res) => {
    try {
        const { district_id } = req.query

        const where = {}

        if (district_id) {
            where.district_id = district_id
        }

        const search = String(req.query.search || '').trim();
        if (search) {
            where[Op.or] = [
                { area_name: { [Op.like]: `%${search}%` } },
                { '$district.district_name$': { [Op.like]: `%${search}%` } }
            ];
        }
        if (req.query.status === 'true') where.status = 1;
        if (req.query.status === 'false') where.status = 0;

        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined;
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));

        const query = {
            where,
            include: [
                {
                    model: DeliveryDistrict,
                    as: "district",
                    attributes: [
                        "id",
                        "district_name"
                    ]
                }
            ],
            attributes: [
                "id",
                "district_id",
                "area_name",
                "first_kg_charge",
                "additional_kg_charge",
                "status"
            ],
            order: [
                ["area_name", "ASC"]
            ]
        };
        const result = paginationEnabled
            ? await DeliveryArea.findAndCountAll({ ...query, limit: pageSize, offset: (page - 1) * pageSize, distinct: true })
            : { rows: await DeliveryArea.findAll(query), count: null };

        return res.status(200).json({
            success: true,
            data: result.rows,
            ...(paginationEnabled ? { pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } } : {})
        })

    } catch (error) {
        console.error(
            "Get delivery areas error:",
            error
        )

        return res.status(500).json({
            success: false,
            message: "Failed to load delivery areas."
        })
    }
}


// =====================================================
// GET AREAS BY DISTRICT
//
// GET /delivery-areas/by-district?district_id=1
//
// Used when selecting a district in customer address.
// Only active areas are returned.
// =====================================================

const getAreasByDistrict = async (req, res) => {
    try {
        const { district_id } = req.query

        if (!district_id) {
            return res.status(400).json({
                success: false,
                message: "district_id is required."
            })
        }

        const areas = await DeliveryArea.findAll({
            where: {
                district_id: district_id,
                status: 1
            },
            attributes: [
                "id",
                "district_id",
                "area_name",
                "first_kg_charge",
                "additional_kg_charge"
            ],
            order: [
                ["area_name", "ASC"]
            ]
        })

        return res.status(200).json({
            success: true,
            data: areas
        })

    } catch (error) {
        console.error(
            "Get areas by district error:",
            error
        )

        return res.status(500).json({
            success: false,
            message: "Failed to load delivery areas."
        })
    }
}


// =====================================================
// CALCULATE DELIVERY CHARGE
//
// POST /delivery-areas/calculate
//
// Body:
// {
//     "area_id": 1,
//     "total_weight_kg": 2.4
// }
// =====================================================

const calculateDeliveryCharge = async (req, res) => {
    try {
        const {
            area_id,
            total_weight_kg
        } = req.body

        if (!area_id) {
            return res.status(400).json({
                success: false,
                message: "area_id is required."
            })
        }


        const isValidWeightType =
            typeof total_weight_kg === "number" ||
            (typeof total_weight_kg === "string" &&
                total_weight_kg.trim() !== "");

        const totalWeightKg = Number(total_weight_kg);

        if (
            !isValidWeightType ||
            !Number.isFinite(totalWeightKg) ||
            totalWeightKg <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "total_weight_kg must be a finite number greater than 0."
            });
        }

        const area = await DeliveryArea.findOne({
            where: {
                id: area_id,
                status: 1
            }
        });

        if (!area) {
            return res.status(400).json({
                success: false,
                message: "Delivery is not available for this area."
            });
        }

        const district = await DeliveryDistrict.findOne({
            where: {
                id: area.district_id,
                status: 1
            }
        });

        if (!district) {
            return res.status(400).json({
                success: false,
                message: "Delivery is not available for this area."
            });
        }


        // Charge by each started kilogram
        const chargeableWeightKg = Math.ceil(totalWeightKg)

        const firstKgCharge =
            Number(area.first_kg_charge || 0)

        const additionalKgCharge =
            Number(area.additional_kg_charge || 0)

        const deliveryCharge =
            firstKgCharge +
            Math.max(
                0,
                chargeableWeightKg - 1
            ) * additionalKgCharge

        await auditDeliveryAction(req, {
            action: 'DELIVERY_CHARGE_CALCULATED',
            entityId: area.id,
            description: 'Delivery charge calculated successfully',
            newValues: {
                area_id: area.id,
                district_id: area.district_id,
                total_weight_kg: totalWeightKg,
                chargeable_weight_kg: chargeableWeightKg,
                first_kg_charge: firstKgCharge,
                additional_kg_charge: additionalKgCharge,
                delivery_charge: deliveryCharge
            }
        });

        return res.status(200).json({
            success: true,
            message: "Delivery charge calculated successfully.",
            data: {
                area_id: area.id,
                area_name: area.area_name,
                total_weight_kg: totalWeightKg,
                chargeable_weight_kg: chargeableWeightKg,
                first_kg_charge: firstKgCharge,
                additional_kg_charge: additionalKgCharge,
                delivery_charge: deliveryCharge
            }
        })

    } catch (error) {
        await auditDeliveryAction(req, {
            action: 'DELIVERY_CHARGE_CALCULATION_FAILED',
            entityId: req.body?.area_id ?? null,
            description: 'Unexpected error while calculating delivery charge',
            newValues: {
                area_id: req.body?.area_id ?? null
            }
        });

        console.error(
            "Calculate delivery charge error:",
            error
        )

        return res.status(500).json({
            success: false,
            message: "Failed to calculate delivery charge."
        })
    }
}


module.exports = {
    getDeliveryAreas,
    getAreasByDistrict,
    calculateDeliveryCharge
}
