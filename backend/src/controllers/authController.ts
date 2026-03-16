import { Request, Response } from 'express';
import { db } from '../config/firebase';
import generateToken from '../utils/generateToken';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';

/* ── Helper: generate unique referral code ─── */
const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'REF';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, referralCode } = req.body;
  try {
    const usersRef = db.collection('users');
    
    // Check if user exists
    const emailSnapshot = await usersRef.where('email', '==', email).limit(1).get();
    const usernameSnapshot = await usersRef.where('username', '==', username).limit(1).get();
    
    if (!emailSnapshot.empty || !usernameSnapshot.empty) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let bonusBalance = 100000; // default welcome bonus
    let referredBy: string | null = null;

    // Process referral code if provided
    if (referralCode && referralCode.trim()) {
      const referrerSnapshot = await usersRef
        .where('referralCode', '==', referralCode.trim().toUpperCase())
        .limit(1).get();

      if (!referrerSnapshot.empty) {
        const referrerDoc = referrerSnapshot.docs[0];
        const referrerData = referrerDoc.data();

        // Give referrer ₹500 bonus
        await referrerDoc.ref.update({
          coin_balance: (referrerData.coin_balance || 0) + 500,
          referralCount: (referrerData.referralCount || 0) + 1,
          referralEarnings: (referrerData.referralEarnings || 0) + 500,
        });

        // Give new user ₹500 extra bonus
        bonusBalance += 500;
        referredBy = referrerDoc.id;
      }
    }

    const myReferralCode = generateReferralCode();

    const newUserRef = await usersRef.add({
      username,
      email,
      password: hashedPassword,
      coin_balance: bonusBalance,
      role: 'user',
      phone: '',
      referralCode: myReferralCode,
      referralCount: 0,
      referralEarnings: 0,
      referredBy: referredBy,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      _id: newUserRef.id,
      username,
      email,
      coin_balance: bonusBalance,
      role: 'user',
      phone: '',
      referralCode: myReferralCode,
      referralCount: 0,
      referralEarnings: 0,
      createdAt: new Date().toISOString(),
      token: generateToken(newUserRef.id as any),
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const authUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (snapshot.empty) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    res.json({
      _id: userDoc.id,
      username: user.username,
      email: user.email,
      coin_balance: user.coin_balance,
      role: user.role,
      phone: user.phone || '',
      referralCode: user.referralCode || '',
      referralCount: user.referralCount || 0,
      referralEarnings: user.referralEarnings || 0,
      createdAt: user.createdAt || '',
      token: generateToken(userDoc.id as any),
    });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      res.json({
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        coin_balance: req.user.coin_balance,
        role: req.user.role,
        phone: req.user.phone || '',
        referralCode: req.user.referralCode || '',
        referralCount: req.user.referralCount || 0,
        referralEarnings: req.user.referralEarnings || 0,
        createdAt: req.user.createdAt || '',
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
