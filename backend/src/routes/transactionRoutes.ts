import express from 'express';
import { requestDeposit, requestWithdrawal, getMyTransactions } from '../controllers/transactionController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/deposit', protect, requestDeposit as express.RequestHandler);
router.post('/withdraw', protect, requestWithdrawal as express.RequestHandler);
router.get('/my', protect, getMyTransactions as express.RequestHandler);

export default router;
