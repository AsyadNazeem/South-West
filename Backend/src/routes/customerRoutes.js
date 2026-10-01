const express = require('express');
const customerController = require('../controllers/customerController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.post(
    '/',
    authenticate,
    requirePermission('customers.create'),
    customerController.createCustomer
);

router.get(
    '/',
    authenticate,
    requirePermission('customers.view'),
    customerController.getCustomers
);

router.get(
    '/:id',
    authenticate,
    requirePermission('customers.view'),
    customerController.getCustomer
);

router.put(
    '/:id',
    authenticate,
    requirePermission('customers.update'),
    customerController.updateCustomer
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('customers.delete'),
    customerController.deleteCustomer
);


module.exports = router;
