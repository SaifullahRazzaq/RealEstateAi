import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../lib/apiError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireAdmin, authUser } from '../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

/** GET /api/users — team members of the caller's company. */
usersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = authUser(req);
    const users = await User.find({ companyId: user.companyId })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ users });
  })
);

/** POST /api/users — invite an agent or another admin. */
usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const admin = authUser(req);
    const { name, email, password, role } = req.body ?? {};

    if (!name || !email || !password) {
      throw new ApiError('VALIDATION_ERROR', 'Name, email and password are required.');
    }
    if (String(password).length < 6) {
      throw new ApiError('VALIDATION_ERROR', 'Password must be at least 6 characters.');
    }
    if (role && !['admin', 'agent'].includes(role)) {
      throw new ApiError('VALIDATION_ERROR', "Role must be either 'admin' or 'agent'.");
    }

    const normalizedEmail = String(email).toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      throw new ApiError('CONFLICT', 'A user with that email already exists.');
    }

    const created = await User.create({
      name,
      email: normalizedEmail,
      password: await bcrypt.hash(String(password), 12),
      role: role || 'agent',
      companyId: admin.companyId,
    });

    res.status(201).json({
      user: {
        id: created._id.toString(),
        name: created.name,
        email: created.email,
        role: created.role,
      },
    });
  })
);
