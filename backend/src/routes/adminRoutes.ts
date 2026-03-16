import express from 'express';
import { getPendingWithdrawals, handleWithdrawal, getPlatformMetrics } from '../controllers/adminController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/withdrawals', protect, admin, getPendingWithdrawals as express.RequestHandler);
router.put('/withdrawals/:id', protect, admin, handleWithdrawal as express.RequestHandler);
router.get('/metrics', protect, admin, getPlatformMetrics as express.RequestHandler);

export default router;
