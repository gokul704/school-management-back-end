const express = require('express');
const router = express.Router();
const admissionsController = require('../controllers/admissionsController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticateToken, admissionsController.getAll);
router.get('/:id', authenticateToken, admissionsController.getById);
router.post('/', authenticateToken, admissionsController.create);
router.patch('/:id/status', authenticateToken, admissionsController.updateStatus);
router.post('/:id/documents', authenticateToken, upload.single('file'), admissionsController.uploadDocument);

module.exports = router;

