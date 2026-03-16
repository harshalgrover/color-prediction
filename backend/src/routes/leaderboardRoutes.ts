import express from 'express';
import { getLeaderboard } from '../controllers/leaderboardController';

const router = express.Router();

router.get('/', getLeaderboard as express.RequestHandler);

export default router;
