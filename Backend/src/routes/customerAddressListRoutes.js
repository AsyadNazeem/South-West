const express = require('express');
const customerAddressController = require('../controllers/customerAddressController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.get(
    '/',
    authenticate,
    requirePermission('customers.view'),
    customerAddressController.getAllAddresses
);

router.delete(
    '/:addressId',
    authenticate,
    requirePermission('customers.update'),
    customerAddressController.deleteAddressById
);

module.exports = router;
