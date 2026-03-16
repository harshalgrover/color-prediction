import { Response } from 'express';
import { db } from '../config/firebase';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Update profile info (username, phone)
// @route   PUT /api/profile/update
// @access  Private
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const { username, phone } = req.body;
    const updateData: any = {};

    if (username && username.trim()) {
      // Check if username is taken by another user
      const existing = await db.collection('users')
        .where('username', '==', username.trim())
        .limit(1).get();

      if (!existing.empty && existing.docs[0].id !== req.user._id) {
        res.status(400).json({ message: 'Username already taken' });
        return;
      }
      updateData.username = username.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim();
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: 'Nothing to update' });
      return;
    }

    await db.collection('users').doc(req.user._id).update(updateData);

    res.json({ message: 'Profile updated', ...updateData });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Change password
// @route   PUT /api/profile/password
// @access  Private
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Both current and new password required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters' });
      return;
    }

    // Get user with password field
    const userDoc = await db.collection('users').doc(req.user._id).get();
    const userData = userDoc.data();

    if (!userData) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, userData.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await db.collection('users').doc(req.user._id).update({ password: hashedPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
