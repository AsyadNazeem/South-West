const { Customer, CustomerAddress } = require('../models');

async function createAddress(req, res) {
    try {
        const customer = await Customer.findByPk(req.params.customerId);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        const {
            address_type,
            recipient_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            is_default
        } = req.body;

        if (!recipient_name || !phone || !address_line_1 || !city) {
            return res.status(400).json({
                message: 'Recipient name, phone, address line 1 and city are required'
            });
        }

        if (is_default) {
            await CustomerAddress.update(
                { is_default: false },
                {
                    where: {
                        customer_id: customer.id
                    }
                }
            );
        }

        const address = await CustomerAddress.create({
            customer_id: customer.id,
            address_type,
            recipient_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            is_default: is_default || false
        });

        return res.status(201).json({
            message: 'Customer address created successfully',
            data: address
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Unable to create customer address'
        });
    }
}

async function getAddresses(req, res) {
    try {
        const customer = await Customer.findByPk(req.params.customerId);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        const addresses = await CustomerAddress.findAll({
            where: {
                customer_id: customer.id
            },
            order: [
                ['is_default', 'DESC'],
                ['id', 'DESC']
            ]
        });

        return res.status(200).json({
            message: 'Customer addresses retrieved successfully',
            data: addresses
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Unable to retrieve customer addresses'
        });
    }
}

async function updateAddress(req, res) {
    try {
        const address = await CustomerAddress.findOne({
            where: {
                id: req.params.addressId,
                customer_id: req.params.customerId
            }
        });

        if (!address) {
            return res.status(404).json({
                message: 'Customer address not found'
            });
        }

        const {
            address_type,
            recipient_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            is_default
        } = req.body;

        if (is_default) {
            await CustomerAddress.update(
                { is_default: false },
                {
                    where: {
                        customer_id: req.params.customerId
                    }
                }
            );
        }

        await address.update({
            address_type,
            recipient_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            is_default: is_default || false
        });

        return res.status(200).json({
            message: 'Customer address updated successfully',
            data: address
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Unable to update customer address'
        });
    }
}

async function deleteAddress(req, res) {
    try {
        const address = await CustomerAddress.findOne({
            where: {
                id: req.params.addressId,
                customer_id: req.params.customerId
            }
        });

        if (!address) {
            return res.status(404).json({
                message: 'Customer address not found'
            });
        }

        await address.destroy();

        return res.status(200).json({
            message: 'Customer address deleted successfully'
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Unable to delete customer address'
        });
    }
}

async function getAllAddresses(req, res) {
    try {
        const addresses = await CustomerAddress.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id', 'first_name', 'last_name']
                }
            ],
            order: [['id', 'DESC']]
        });

        const data = addresses.map((a) => {
            const row = a.toJSON();
            const type = (row.address_type || '').toLowerCase();

            return {
                ...row,

                // Frontend-friendly fields
                customer_name: row.customer
                    ? `${row.customer.first_name} ${row.customer.last_name}`.trim()
                    : 'Guest',
                province: row.state || '',
                is_default_shipping: Boolean(row.is_default) && type === 'shipping',
                is_default_billing: Boolean(row.is_default) && type === 'billing'
            };
        });

        return res.status(200).json({
            message: 'Customer addresses retrieved successfully',
            data
        });
    } catch (error) {
        console.error('Get all addresses error:', error);

        return res.status(500).json({
            message: 'Unable to retrieve customer addresses'
        });
    }
}

async function deleteAddressById(req, res) {
    try {
        const address = await CustomerAddress.findByPk(req.params.addressId);

        if (!address) {
            return res.status(404).json({
                message: 'Customer address not found'
            });
        }

        await address.destroy();

        return res.status(200).json({
            message: 'Customer address deleted successfully'
        });
    } catch (error) {
        console.error('Delete address error:', error);

        return res.status(500).json({
            message: 'Unable to delete customer address'
        });
    }
}

module.exports = {
    createAddress,
    getAddresses,
    getAllAddresses,
    updateAddress,
    deleteAddress,
    deleteAddressById
};
