const express = require('express');
const itemTypeController = require('../controllers/itemTypeController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const router = express.Router();

router.get('/', authMiddleware, requirePermission('products.view'), itemTypeController.getAllItemTypes);
router.get('/:id', authMiddleware, requirePermission('products.view'), itemTypeController.getItemTypeById);
router.post('/', authMiddleware, requirePermission('products.create'), itemTypeController.createItemType);
router.put('/:id', authMiddleware, requirePermission('products.update'), itemTypeController.updateItemType);
router.delete('/:id', authMiddleware, requirePermission('products.delete'), itemTypeController.deleteItemType);

module.exports = router;
