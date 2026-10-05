'use strict';

const {
    Customer,
    Item,
    Order,
    InventoryStock
} = require('../models');

const { Op, Sequelize } = require('sequelize');

const getDashboard = async (req, res) => {
    try {
        // -----------------------------
        // Statistics
        // -----------------------------
        const totalCustomers = await Customer.count();
        const totalProducts = await Item.count();
        const totalOrders = await Order.count();

        const salesResult = await Order.sum('total_amount', {
            where: {
                status: {
                    [Op.notIn]: ['cancelled', 'returned']
                }
            }
        });

        const totalSales = Number(salesResult || 0);

        // -----------------------------
        // Recent Orders
        // -----------------------------
        const recentOrders = await Order.findAll({
            limit: 5,
            order: [['order_date', 'DESC']],
            attributes: [
                'id',
                'order_number',
                'order_date',
                'total_amount',
                'status'
            ],
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'first_name', 'last_name']
                }
            ]
        });

        const recentOrdersData = recentOrders.map((o) => ({
            order: o.order_number ? `#${o.order_number}` : `#${o.id}`,

            customer: o.customer
                ? `${o.customer.first_name} ${o.customer.last_name}`.trim()
                : 'Guest',

            date: o.order_date
                ? new Date(o.order_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                })
                : '-',

            amount: Number(o.total_amount),

            status: o.status
        }));

        // -----------------------------
        // Low Stock
        // -----------------------------
        const lowStock = await InventoryStock.findAll({
            where: {
                is_active: true,
                quantity_on_hand: {
                    [Op.lte]: Sequelize.col('InventoryStock.reorder_level')
                }
            },
            limit: 10,
            order: [['quantity_on_hand', 'ASC']],
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: ['id', 'item_code', 'item_name']
                }
            ]
        });

        const lowStockData = lowStock.map((stock) => ({
            code: stock.item?.item_code || '',
            name: stock.item?.item_name || '',
            stock: Number(stock.quantity_on_hand)
        }));

        // -----------------------------
        // Response
        // -----------------------------
        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalCustomers,
                    totalProducts,
                    totalOrders,
                    totalSales
                },
                salesChart: [],
                recentOrders: recentOrdersData,
                lowStockItems: lowStockData
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load dashboard data.'
        });
    }
};

module.exports = {
    getDashboard
};
