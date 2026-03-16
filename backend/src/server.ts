import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import './config/firebase'; // Initialize Firebase
import authRoutes from './routes/authRoutes';
import transactionRoutes from './routes/transactionRoutes';
import adminRoutes from './routes/adminRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';
import profileRoutes from './routes/profileRoutes';
import { initGameEngine } from './sockets/gameEngine';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Express and Socket.IO
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize Socket.IO
export const io = new Server(server, {
  cors: corsOptions,
});

// Firebase is already initialized via import

// Init Game Engine
initGameEngine(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/profile', profileRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = 5005;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
