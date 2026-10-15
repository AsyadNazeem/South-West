
const express = require('express');
const controller = require('../controllers/customerAddressController');
const customerAuth = require('../middleware/customerAuthMiddleware');

const router = express.Router();

router.use(customerAuth);

router.post('/', controller.createAddress);
router.get('/', controller.getAddresses);
router.get('/:addressId', controller.getAddressById);
router.patch('/:addressId', controller.updateAddress);
router.delete('/:addressId', controller.deleteAddress);

module.exports = router;
