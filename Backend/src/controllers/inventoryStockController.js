const { Op, literal } = require('sequelize');
const {
  sequelize,
  InventoryStock,
  InventoryStockMovement,
  Item,
  ItemVariant,
  InventoryLocation
} = require("../models");

const { recordAuditLog } = require("../services/auditLogService");

// GET ALL STOCK
const getInventoryStocks = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
    const where = {};
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = [
      { '$item.item_code$': { [Op.like]: `%${search}%` } },
      { '$item.item_name$': { [Op.like]: `%${search}%` } },
      { '$variant.variant_sku$': { [Op.like]: `%${search}%` } },
      { '$variant.variant_name$': { [Op.like]: `%${search}%` } },
      { '$location.code$': { [Op.like]: `%${search}%` } },
      { '$location.name$': { [Op.like]: `%${search}%` } },
    ];
    if (req.query.level === 'out') where[Op.and] = [literal('(quantity_on_hand - quantity_reserved) <= 0')];
    if (req.query.level === 'low') where[Op.and] = [literal('(quantity_on_hand - quantity_reserved) > 0 AND reorder_level > 0 AND (quantity_on_hand - quantity_reserved) <= reorder_level')];
    if (req.query.level === 'ok') where[Op.and] = [literal('(quantity_on_hand - quantity_reserved) > 0 AND (reorder_level <= 0 OR (quantity_on_hand - quantity_reserved) > reorder_level)')];
    const result = await InventoryStock.findAndCountAll({
      where,
      include: [
        {
          model: Item,
          as: "item",
          attributes: ["id", "item_code", "item_name"],
        },
        {
          model: InventoryLocation,
          as: "location",
          attributes: ["id", "code", "name", "location_type"],
        },
        {
  model: ItemVariant,
  as: 'variant',
  attributes: ['id', 'variant_sku', 'variant_name']
}
      ],
      order: [["id", "DESC"]], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true,
    });
    const stocks = result.rows;

    return res.status(200).json({
      message: "Inventory stocks retrieved successfully",
      data: stocks,
      pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) },
    });
  } catch (error) {
    console.error("Get inventory stocks error:", error);

    return res.status(500).json({
      message: "Failed to retrieve inventory stocks",
    });
  }
};

// GET STOCK BY ID
const getInventoryStockById = async (req, res) => {
  try {
    const { id } = req.params;

    const stock = await InventoryStock.findByPk(id, {
      include: [
        {
          model: Item,
          as: "item",
          attributes: ["id", "item_code", "item_name"],
        },
        {
          model: InventoryLocation,
          as: "location",
          attributes: ["id", "code", "name", "location_type"],
        },
      ],
    });

    if (!stock) {
      return res.status(404).json({
        message: "Inventory stock not found",
      });
    }

    return res.status(200).json({
      message: "Inventory stock retrieved successfully",
      data: stock,
    });
  } catch (error) {
    console.error("Get inventory stock error:", error);

    return res.status(500).json({
      message: "Failed to retrieve inventory stock",
    });
  }
};

// CREATE STOCK

const createInventoryStock = async (req, res) => {
  let transaction;

  try {
    const {
      item_id,
      variant_id,
      location_id,
      quantity_on_hand,
      quantity_reserved,
      reorder_level,
      reorder_quantity,
    } = req.body;

    transaction = await sequelize.transaction();

    const item = await Item.findByPk(item_id, {
      transaction,
    });

    if (!item) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Item not found",
      });
    }

    if (variant_id === undefined || variant_id === null || variant_id === '') {
      await transaction.rollback();
      return res.status(400).json({
        message: 'A variant is required to create inventory stock',
      });
    }

    const variantId = Number(variant_id);

let variant = null;

if (variantId !== null) {
  if (!Number.isSafeInteger(variantId) || variantId <= 0) {
    await transaction.rollback();
    return res.status(400).json({
      message: 'A valid variant_id is required when a variant is selected',
    });
  }

  variant = await ItemVariant.findOne({
    where: {
      id: variantId,
      item_id: item.id,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!variant) {
    await transaction.rollback();
    return res.status(404).json({
      message: 'Variant not found for this item',
    });
  }

  if (!variant.is_active) {
    await transaction.rollback();
    return res.status(409).json({
      message: 'Cannot create stock for an inactive variant',
    });
  }
}

    const location = await InventoryLocation.findByPk(location_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!location) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Inventory location not found",
      });
    }

const existingStock = await InventoryStock.findOne({
  where: {
    item_id: item.id,
    variant_id: variantId,
    location_id,
  },
  transaction,
  lock: transaction.LOCK.UPDATE,
});

    if (existingStock) {
      await transaction.rollback();

      return res.status(409).json({
        message: "Stock record already exists for this variant and location",
      });
    }

    const stock = await InventoryStock.create(
      {
        item_id,
        variant_id: variantId,
        location_id,
        quantity_on_hand: quantity_on_hand ?? 0,
        quantity_reserved: quantity_reserved ?? 0,
        reorder_level: reorder_level ?? 0,
        reorder_quantity: reorder_quantity ?? 0,
        is_active: true,
      },
      { transaction },
    );

    await recordAuditLog({
      userId: req.user ? (req.user.id ?? req.user.userId) : null,
      action: "INVENTORY_STOCK_CREATED",
      module: "inventory",
      entityType: "inventory_stock",
      entityId: stock.id,
description: `Inventory stock created for item ${item.item_code}${
  variantId !== null ? `, variant ${variantId}` : ''
} at location ${location.name}`,
      newValues: {
        item_id: stock.item_id,
        variant_id: stock.variant_id,
        location_id: stock.location_id,
        quantity_on_hand: stock.quantity_on_hand,
        quantity_reserved: stock.quantity_reserved,
        reorder_level: stock.reorder_level,
        reorder_quantity: stock.reorder_quantity,
        is_active: stock.is_active,
      },
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
      requestId: req.id || null,
      transaction,
    });

    await transaction.commit();

    const createdStock = await InventoryStock.findByPk(stock.id, {
      include: [
        {
          model: Item,
          as: "item",
          attributes: ["id", "item_code", "item_name"],
        },
        {
          model: InventoryLocation,
          as: "location",
          attributes: ["id", "code", "name", "location_type"],
        },
      ],
    });

    return res.status(201).json({
      message: "Inventory stock created successfully",
      data: createdStock,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Create inventory stock error:", error);

    return res.status(500).json({
      message: "Failed to create inventory stock",
    });
  }
};

// UPDATE STOCK SETTINGS

const updateInventoryStock = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;

    transaction = await sequelize.transaction();

    const stock = await InventoryStock.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stock) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Inventory stock not found",
      });
    }

    const { quantity_reserved, reorder_level, reorder_quantity, is_active } =
      req.body;

    const oldValues = {
      quantity_reserved: stock.quantity_reserved,
      reorder_level: stock.reorder_level,
      reorder_quantity: stock.reorder_quantity,
      is_active: stock.is_active,
    };

    const updates = {};

    for (const field of [
      "quantity_reserved",
      "reorder_level",
      "reorder_quantity",
      "is_active",
    ]) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (
      Object.keys(req.body).some(
        (field) =>
          ![
            "quantity_reserved",
            "reorder_level",
            "reorder_quantity",
            "is_active",
          ].includes(field),
      )
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Unsupported field in request",
      });
    }

    if (
      updates.quantity_reserved !== undefined &&
      (!Number.isFinite(Number(updates.quantity_reserved)) ||
        Number(updates.quantity_reserved) < 0)
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message: "quantity_reserved must be a non-negative number",
      });
    }

    for (const field of ["reorder_level", "reorder_quantity"]) {
      if (
        updates[field] !== undefined &&
        (!Number.isFinite(Number(updates[field])) || Number(updates[field]) < 0)
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message: `${field} must be a non-negative number`,
        });
      }
    }

    if (
      updates.is_active !== undefined &&
      typeof updates.is_active !== "boolean"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message: "is_active must be a boolean",
      });
    }

    const reserved = Number(
      updates.quantity_reserved ?? stock.quantity_reserved,
    );

    const onHand = Number(stock.quantity_on_hand);

    if (reserved > onHand) {
      await transaction.rollback();

      return res.status(409).json({
        message: "Reserved quantity cannot exceed quantity on hand",
      });
    }

    await stock.update(updates, { transaction });

    const newValues = {
      quantity_reserved: stock.quantity_reserved,
      reorder_level: stock.reorder_level,
      reorder_quantity: stock.reorder_quantity,
      is_active: stock.is_active,
    };

    const changed = Object.keys(newValues).some(
      (field) => String(oldValues[field]) !== String(newValues[field]),
    );

    if (changed) {
      await recordAuditLog({
        userId: req.user ? (req.user.id ?? req.user.userId) : null,
        action: "INVENTORY_STOCK_UPDATED",
        module: "inventory",
        entityType: "inventory_stock",
        entityId: stock.id,
        description: `Inventory stock settings updated for item ${stock.item_id} at location ${stock.location_id}`,
        oldValues,
        newValues,
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
        requestId: req.id || null,
        transaction,
      });
    }

    await transaction.commit();

    const updatedStock = await InventoryStock.findByPk(id, {
      include: [
        {
          model: Item,
          as: "item",
          attributes: ["id", "item_code", "item_name"],
        },
        {
          model: InventoryLocation,
          as: "location",
          attributes: ["id", "code", "name", "location_type"],
        },
      ],
    });

    return res.status(200).json({
      message: "Inventory stock updated successfully",
      data: updatedStock,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Update inventory stock error:", error);

    return res.status(500).json({
      message: "Failed to update inventory stock",
    });
  }
};

// DELETE STOCK

const deleteInventoryStock = async (req, res) => {
  let transaction;

  try {
    const { id } = req.params;

    transaction = await sequelize.transaction();

    const stock = await InventoryStock.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stock) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Inventory stock not found",
      });
    }

    const oldValues = {
      item_id: stock.item_id,
      location_id: stock.location_id,
      quantity_on_hand: stock.quantity_on_hand,
      quantity_reserved: stock.quantity_reserved,
      reorder_level: stock.reorder_level,
      reorder_quantity: stock.reorder_quantity,
      is_active: stock.is_active,
    };

    // Do not delete stock while quantities are on hand or reserved.
    if (
      Number(stock.quantity_on_hand) !== 0 ||
      Number(stock.quantity_reserved) !== 0
    ) {
      await transaction.rollback();

      return res.status(409).json({
        message: "Cannot delete stock while quantities are on hand or reserved",
      });
    }

    await recordAuditLog({
      userId: req.user ? (req.user.id ?? req.user.userId) : null,
      action: "INVENTORY_STOCK_DELETED",
      module: "inventory",
      entityType: "inventory_stock",
      entityId: stock.id,
      description: `Inventory stock record deleted for item ${stock.item_id} at location ${stock.location_id}`,
      oldValues,
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
      requestId: req.id || null,
      transaction,
    });

    await stock.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      message: "Inventory stock deleted successfully",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error("Delete inventory stock error:", error);

    return res.status(500).json({
      message: "Failed to delete inventory stock",
    });
  }
};

// SET ACTUAL ONLINE STOCK COUNT
const setOnlineStockCount = async (req, res) => {
  const { item_id, variant_id, counted_quantity, notes } = req.body;

  // Accept only the fields supported by this endpoint.
  const allowedFields = ["item_id", "variant_id", "counted_quantity", "notes"];

  if (
    !req.body ||
    Object.keys(req.body).some((key) => !allowedFields.includes(key))
  ) {
    return res.status(400).json({
      message: "Unsupported field in request",
    });
  }

  const itemId = Number(item_id);
  const counted = Number(counted_quantity);

  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return res.status(400).json({
      message: "A valid item_id is required",
    });
  }

  const variantId = Number(variant_id);

  if (!Number.isSafeInteger(variantId) || variantId <= 0) {
    return res.status(400).json({
      message: "A valid variant_id is required",
    });
  }

  if (
    counted_quantity === undefined ||
    counted_quantity === null ||
    counted_quantity === "" ||
    !Number.isFinite(counted) ||
    counted < 0 ||
    !/^\d+(\.\d{1,3})?$/.test(String(counted_quantity))
  ) {
    return res.status(400).json({
      message:
        "counted_quantity must be a non-negative number with up to 3 decimal places",
    });
  }

  if (
    notes !== undefined &&
    notes !== null &&
    (typeof notes !== "string" || notes.length > 2000)
  ) {
    return res.status(400).json({
      message: "notes must be a string of up to 2000 characters",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    // Resolve the online location on the server.
    const onlineLocations = await InventoryLocation.findAll({
      where: {
        location_type: "online",
        is_active: true,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (onlineLocations.length !== 1) {
      await transaction.rollback();

      return res.status(409).json({
        message:
          "Exactly one active online inventory location must be configured",
      });
    }

    const onlineLocation = onlineLocations[0];

    const item = await Item.findByPk(itemId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Item not found",
      });
    }

    if (!item.is_active) {
      await transaction.rollback();

      return res.status(409).json({
        message: "Cannot update stock for an inactive item",
      });
    }

    const variant = await ItemVariant.findOne({
      where: {
        id: variantId,
        item_id: itemId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!variant) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Variant not found for this item",
      });
    }

    if (!variant.is_active) {
      await transaction.rollback();

      return res.status(409).json({
        message: "Cannot update stock for an inactive variant",
      });
    }

    let stock = await InventoryStock.findOne({
      where: {
        variant_id: variantId,
        location_id: onlineLocation.id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!stock) {
      stock = await InventoryStock.create(
        {
          item_id: itemId,
          variant_id: variantId,
          location_id: onlineLocation.id,
          quantity_on_hand: 0,
          quantity_reserved: 0,
          reorder_level: 0,
          reorder_quantity: 0,
          is_active: true,
        },
        { transaction },
      );
    }

    if (!stock.is_active) {
      await transaction.rollback();

      return res.status(409).json({
        message: "The online stock record is inactive",
      });
    }

    const previous = Number(stock.quantity_on_hand);
    const reserved = Number(stock.quantity_reserved);
    const difference = Number((counted - previous).toFixed(3));

    // Never set physical stock below quantities already reserved.
    if (counted < reserved) {
      await transaction.rollback();

      return res.status(409).json({
        message: "Counted quantity cannot be below the reserved quantity",
        reserved_quantity: reserved,
      });
    }

    if (difference === 0) {
      await transaction.commit();

      return res.status(200).json({
        message: "Online stock count verified; no quantity change required",
        data: {
          item_id: itemId,
          variant_id: variantId,
          location_id: onlineLocation.id,
          previous_quantity: previous,
          counted_quantity: counted,
          quantity_on_hand: previous,
          adjustment: 0,
        },
      });
    }

    // Set the absolute count. Never add the count to the old balance.
    await stock.update({ quantity_on_hand: counted }, { transaction });

    await InventoryStockMovement.create(
      {
        item_id: itemId,
        variant_id: variantId,
        location_id: onlineLocation.id,
        movement_type: "adjustment",
        quantity: Math.abs(difference),
        reference_type: "daily_stock_count",
        reference_id: null,
        notes: [
          `Daily online stock count`,
          `Previous quantity: ${previous}`,
          `Counted quantity: ${counted}`,
          `Signed difference: ${difference}`,
          notes ? `Staff notes: ${notes}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        created_by: req.user.id,
        created_at: new Date(),
      },
      { transaction },
    );

    await recordAuditLog({
      userId: req.user ? (req.user.id ?? req.user.userId) : null,
      action: "ONLINE_STOCK_COUNT_ADJUSTED",
      module: "inventory",
      entityType: "inventory_stock",
      entityId: stock.id,
      description: `Online stock count adjusted for item ${itemId}, variant ${variantId} at location ${onlineLocation.id}`,
      oldValues: {
        variant_id: variantId,
        quantity_on_hand: previous,
      },
      newValues: {
        variant_id: variantId,
        quantity_on_hand: counted,
        adjustment: difference,
        quantity_reserved: reserved,
        notes: notes || null,
      },
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
      requestId: req.id || null,
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      message: "Online stock count updated successfully",
      data: {
        item_id: itemId,
        variant_id: variantId,
        location_id: onlineLocation.id,
        previous_quantity: previous,
        counted_quantity: counted,
        quantity_on_hand: counted,
        adjustment: difference,
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Set online stock count error:", error);

    return res.status(500).json({
      message: "Failed to update online stock count",
    });
  }
};

module.exports = {
  getInventoryStocks,
  getInventoryStockById,
  createInventoryStock,
  updateInventoryStock,
  deleteInventoryStock,
  setOnlineStockCount,
};
