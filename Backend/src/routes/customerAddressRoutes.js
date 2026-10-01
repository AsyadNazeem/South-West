const express = require('express');
const customerAddressController = require('../controllers/customerAddressController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.post(
    '/:customerId/addresses',
    authenticate,
    requirePermission('customers.update'),
    customerAddressController.createAddress
);

router.get(
    '/:customerId/addresses',
    authenticate,
    requirePermission('customers.view'),
    customerAddressController.getAddresses
);

router.put(
    '/:customerId/addresses/:addressId',
    authenticate,
    requirePermission('customers.update'),
    customerAddressController.updateAddress
);

router.delete(
    '/:customerId/addresses/:addressId',
    authenticate,
    requirePermission('customers.update'),
    customerAddressController.deleteAddress
);

module.exports = router;
