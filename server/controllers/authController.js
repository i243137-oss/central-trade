import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dbManager from '../services/database/ManagementOfDatabase.js';
import config from '../config/config.js';

export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
        errorCode: 'MISSING_FIELDS'
      });
    }

    const existing = await dbManager.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
        errorCode: 'USER_ALREADY_EXISTS'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Default to USER role unless explicitly SYSTEM_MANAGER
    const userRole = role === 'SYSTEM_MANAGER' ? 'SYSTEM_MANAGER' : 'USER';

    const newUser = await dbManager.insertUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: userRole
    });

    // Create corresponding Security Account (SRS 1.2 & R06)
    const initialBalance = userRole === 'SYSTEM_MANAGER' ? 100000.0 : config.defaultUserBalance;
    const newAccount = await dbManager.insertAccount({
      userId: newUser.id,
      totalBalance: initialBalance,
      availableBalance: initialBalance,
      frozenBalance: 0
    });

    const token = jwt.sign(
      { id: newUser.id, role: newUser.role, email: newUser.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    await dbManager.insertLog('USER_REGISTERED', {
      userId: newUser.id,
      role: newUser.role,
      email: newUser.email
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        },
        account: newAccount
      }
    });
  } catch (err) {
    console.error('[authController.register] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
        errorCode: 'MISSING_FIELDS'
      });
    }

    const user = await dbManager.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: No account found with this email.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials: Incorrect password.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    const account = await dbManager.findAccountByUserId(user.id);

    await dbManager.insertLog('USER_LOGIN', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        account
      }
    });
  } catch (err) {
    console.error('[authController.login] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.',
      errorCode: 'SERVER_ERROR'
    });
  }
}

export async function getMe(req, res) {
  try {
    const user = await dbManager.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const account = await dbManager.findAccountByUserId(user.id);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        account
      }
    });
  } catch (err) {
    console.error('[authController.getMe] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user profile.',
      errorCode: 'SERVER_ERROR'
    });
  }
}
