/**
 * AuthService — signup, login, getMe
 *
 * Spec refs: §8.17 (Email+Password auth), §8.18 (bcrypt), §8.19 (JWT),
 *            §8.20 (RBAC), §5.5 (users table)
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
export function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'dealflow360-dev-secret-change-in-production';
}
const JWT_EXPIRES_IN = '8h'; // short-lived per §8.19

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
  customerId: string | null; // required for CUSTOMER portal isolation (§8.21)
}

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  customerId: string | null;
  isActive: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toSafeUser(user: {
  id: string; email: string; firstName: string; lastName: string;
  role: UserRole; customerId: string | null; isActive: boolean;
}): SafeUser {
  // Never expose password_hash — §8.18
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, customerId: user.customerId, isActive: user.isActive };
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

// ── Service Functions ──────────────────────────────────────────────────────────

/**
 * Create a new user account. Only ADMIN should call this in production;
 * the endpoint is open for hackathon convenience.
 */
export async function signup(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: UserRole,
  customerId?: string,
): Promise<{ user: SafeUser; token: string }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error('Email already in use'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, role, firstName, lastName, customerId: customerId ?? null },
  });

  const token = signToken({ userId: user.id, role: user.role, email: user.email, customerId: user.customerId });
  return { user: toSafeUser(user), token };
}

/**
 * Authenticate with email + password, return JWT + safe user profile.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ user: SafeUser; token: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Use consistent timing to avoid user-enumeration (§8.18)
  const dummyHash = '$2b$12$invalidhashpadding0000000000000000000000000000000000000';
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);

  if (!user || !valid || !user.isActive) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signToken({ userId: user.id, role: user.role, email: user.email, customerId: user.customerId });
  return { user: toSafeUser(user), token };
}

/**
 * Fetch the current user's profile (for GET /me).
 */
export async function getMe(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return toSafeUser(user);
}
