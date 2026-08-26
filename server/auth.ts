import crypto from 'crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import type { FamilyRow } from './types';

export const FAMILY_COOKIE = 'hc_family';
export const PARENT_COOKIE = 'hc_parent';

export const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const PARENT_WINDOW_MS = 30 * 60 * 1000;

// Unambiguous alphabet (no 0/O, 1/I/L) - the code gets read aloud and typed by hand
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function hashPin(pin: string | number): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPin(pin: unknown, stored: string | null | undefined): boolean {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function generateFamilyCode(): string {
  const pick = () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}`;
}

export function normalizeFamilyCode(raw: unknown): string | null {
  const clean = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 6) return null;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

export function cookieOptions(isProd: boolean, maxAge: number): CookieOptions {
  return { signed: true, httpOnly: true, sameSite: 'lax', secure: isProd, maxAge };
}

export function makeRequireFamily(db: Database.Database) {
  const familyById = db.prepare('SELECT * FROM families WHERE id = ?');
  return (req: Request, res: Response, next: NextFunction): void => {
    const familyId = req.signedCookies[FAMILY_COOKIE] as string | undefined;
    const family = familyId ? (familyById.get(familyId) as FamilyRow | undefined) : undefined;
    if (!family) {
      res.status(401).json({ error: 'Please sign in first', needFamily: true });
      return;
    }
    req.family = family;
    next();
  };
}

// Must run after requireFamily. The parent cookie is a short-lived proof that
// the parent PIN was entered on this device.
export function makeRequireParent() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.signedCookies[PARENT_COOKIE] !== req.family.id) {
      res.status(401).json({ error: 'Parent PIN required', needPin: true });
      return;
    }
    next();
  };
}
