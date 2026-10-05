const { Customer, CustomerAddress } = require('../models');

async function createCustomer(req, res) {
    try {
        const {
            customer_code,
            first_name,
            last_name,
            email,
            phone
        } = req.body;

        if (!customer_code || !first_name || !last_name || !phone) {
            return res.status(400).json({
                message: 'Customer code, first name, last name and phone are required'
            });
        }

        const existingCustomer = await Customer.findOne({
            where: { customer_code }
        });

        if (existingCustomer) {
            return res.status(409).json({
                message: 'Customer code already exists'
            });
        }

        const customer = await Customer.create({
            customer_code,
            first_name,
            last_name,
            email,
            phone
        });

        return res.status(201).json({
            message: 'Customer created successfully',
            data: customer
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Unable to create customer'
        });
    }
}

async function getCustomers(req, res) {
    try {
        const customers = await Customer.findAll({
            include: [
                {
                    model: CustomerAddress,
                    as: "addresses"
                }
            ],
            order: [["id", "DESC"]]
        });

        const data = customers.map((customer) => {
            const customerData = customer.toJSON();

            return {
                ...customerData,

                // Frontend-friendly fields
                mobile: customerData.phone || "",

                // Temporary values until Order integration
                orders: customerData.orders || 0,
                total_spent: customerData.total_spent || 0,

                status: customerData.is_active
                    ? "active"
                    : "inactive"
            };
        });

        return res.status(200).json({
            message: "Customers retrieved successfully",
            data
        });

    } catch (error) {
        console.error("Get customers error:", error);

        return res.status(500).json({
            message: "Unable to retrieve customers"
        });
    }
}

async function getCustomer(req, res) {
    try {
        const customer = await Customer.findByPk(req.params.id, {
            include: [
                {
                    model: CustomerAddress,
                    as: "addresses"
                }
            ]
        });

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        const customerData = customer.toJSON();

        return res.status(200).json({
            message: "Customer retrieved successfully",
            data: {
                ...customerData,
                mobile: customerData.phone || "",
                status: customerData.is_active ? "active" : "inactive"
            }
        });
    } catch (error) {
        console.error("Get customer error:", error);

        return res.status(500).json({
            message: "Unable to retrieve customer"
        });
    }
}

async function updateCustomer(req, res) {
    try {
        const customer = await Customer.findByPk(req.params.id);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        const {
            first_name,
            last_name,
            email,
            phone,
            is_active
        } = req.body;

        await customer.update({
            first_name,
            last_name,
            email,
            phone,
            is_active
        });

        return res.status(200).json({
            message: 'Customer updated successfully',
            data: customer
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Unable to update customer'
        });
    }
}

async function deleteCustomer(req, res) {
    try {
        const customer = await Customer.findByPk(req.params.id);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        await customer.destroy();

        return res.status(200).json({
            message: 'Customer deleted successfully'
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Unable to delete customer'
        });
    }
}

module.exports = {
    createCustomer,
    getCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer
};
