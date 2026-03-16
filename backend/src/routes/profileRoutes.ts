import express from 'express';
import { updateProfile, changePassword } from '../controllers/profileController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.put('/update', protect, updateProfile as express.RequestHandler);
router.put('/password', protect, changePassword as express.RequestHandler);

export default router;
