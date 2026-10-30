const { Op } = require('sequelize')
const { Item, ItemPrice } = require('../models')

const getSellingPrice = async ({
                                   itemId,
                                   orderDate,
                                   transaction
                               }) => {
    const item = await Item.findOne({
        where: {
            id: itemId,
            is_active: true
        },
        transaction
    })

    if (!item) {
        const error = new Error(`Item ${itemId} not found or inactive.`)
        error.statusCode = 404
        throw error
    }

    const priceDate = orderDate
        ? new Date(orderDate)
        : new Date()

    if (Number.isNaN(priceDate.getTime())) {
        const error = new Error('Invalid order date.')
        error.statusCode = 400
        throw error
    }

    const sellingPrice = await ItemPrice.findOne({
        where: {
            item_id: itemId,
            price_type: 'selling',
            is_active: true,
            effective_from: {
                [Op.or]: [
                    { [Op.lte]: priceDate },
                    { [Op.is]: null }
                ]
            },
            [Op.or]: [
                {
                    effective_to: {
                        [Op.gte]: priceDate
                    }
                },
                {
                    effective_to: {
                        [Op.is]: null
                    }
                }
            ]
        },
        order: [
            ['effective_from', 'DESC'],
            ['id', 'DESC']
        ],
        transaction
    })

    if (!sellingPrice) {
        const error = new Error(
            `No active selling price found for item ${itemId}.`
        )
        error.statusCode = 400
        throw error
    }

    return {
        item,
        price: Number(sellingPrice.price),
        currency: sellingPrice.currency,
        price_id: sellingPrice.id
    }
}

const calculateItem = async ({
                                 itemId,
                                 quantity,
                                 discountPercentageMode = false,
                                 discountPercentage = 0,
                                 discountAmount = 0,
                                 orderDate,
                                 transaction
                             }) => {
    const numericQuantity = Number(quantity)

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
        const error = new Error(
            `Invalid quantity for item ${itemId}.`
        )
        error.statusCode = 400
        throw error
    }

    const {
        item,
        price,
        currency,
        price_id
    } = await getSellingPrice({
        itemId,
        orderDate,
        transaction
    })

    let percentage = 0
    let discount = 0

    if (discountPercentageMode) {
        percentage = Number(discountPercentage || 0)

        if (
            !Number.isFinite(percentage) ||
            percentage < 0 ||
            percentage > 100
        ) {
            const error = new Error(
                `Invalid discount percentage for item ${itemId}.`
            )
            error.statusCode = 400
            throw error
        }

        const grossAmount = numericQuantity * price

        discount = grossAmount * (percentage / 100)
    } else {
        discount = Number(discountAmount || 0)

        if (!Number.isFinite(discount) || discount < 0) {
            const error = new Error(
                `Invalid discount amount for item ${itemId}.`
            )
            error.statusCode = 400
            throw error
        }

        const grossAmount = numericQuantity * price

        if (discount > grossAmount) {
            const error = new Error(
                `Discount cannot exceed item amount for item ${itemId}.`
            )
            error.statusCode = 400
            throw error
        }

        if (grossAmount > 0) {
            percentage = (discount / grossAmount) * 100
        }
    }

    const grossAmount = numericQuantity * price
    const lineTotal = grossAmount - discount

    const shippingWeight = Number(item.shipping_weight || 0)

    let shippingWeightKg = 0

    if (shippingWeight > 0) {
        if (item.shipping_weight_unit === 'g') {
            shippingWeightKg = shippingWeight / 1000
        } else {
            shippingWeightKg = shippingWeight
        }
    }

    return {
        item_id: item.id,
        item_code: item.item_code,
        item_name: item.item_name,

        quantity: numericQuantity,

        unit_price: price,
        currency,

        price_id,

        discount_percentage_mode: Boolean(
            discountPercentageMode
        ),

        discount_percentage: Number(
            percentage.toFixed(2)
        ),

        discount_amount: Number(
            discount.toFixed(2)
        ),

        line_total: Number(
            lineTotal.toFixed(2)
        ),

        shipping_weight_kg: shippingWeightKg,

        total_shipping_weight_kg:
            shippingWeightKg * numericQuantity
    }
}

module.exports = {
    getSellingPrice,
    calculateItem
}
