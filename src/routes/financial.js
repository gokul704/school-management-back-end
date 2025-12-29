const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financialController');
const { authenticateToken } = require('../middleware/auth');

// Fee Structures
router.get('/fees', authenticateToken, financialController.getFeeStructures);
router.post('/fees', authenticateToken, financialController.createFeeStructure);
router.put('/fees/:id', authenticateToken, financialController.updateFeeStructure);
router.delete('/fees/:id', authenticateToken, financialController.deleteFeeStructure);

// Payments
router.get('/payments', authenticateToken, financialController.getPayments);
router.post('/payments', authenticateToken, financialController.createPayment);
router.get('/payments/:id', authenticateToken, financialController.getPaymentById);

// Reports
router.get('/reports', authenticateToken, financialController.getFinancialReport);

module.exports = router;

