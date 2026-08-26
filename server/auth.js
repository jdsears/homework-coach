const crypto = require('crypto');

const FAMILY_COOKIE = 'hc_family';
const PARENT_COOKIE = 'hc_parent';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const PARENT_WINDOW_MS = 30 * 60 * 1000;

// Unambiguous alphabet (no 0/O, 1/I/L) - the code gets read aloud and typed by hand
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(pin), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function generateFamilyCode() {
  const pick = () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}`;
}

function normalizeFamilyCode(raw) {
  const clean = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 6) return null;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
}

function cookieOptions(isProd, maxAge) {
  return { signed: true, httpOnly: true, sameSite: 'lax', secure: isProd, maxAge };
}

function makeRequireFamily(db) {
  const familyById = db.prepare('SELECT id, name, code, pin_hash FROM families WHERE id = ?');
  return (req, res, next) => {
    const familyId = req.signedCookies[FAMILY_COOKIE];
    const family = familyId ? familyById.get(familyId) : null;
    if (!family) {
      return res.status(401).json({ error: 'Please sign in first', needFamily: true });
    }
    req.family = family;
    next();
  };
}

// Must run after requireFamily. The parent cookie is a short-lived proof that
// the parent PIN was entered on this device.
function makeRequireParent() {
  return (req, res, next) => {
    if (req.signedCookies[PARENT_COOKIE] !== req.family.id) {
      return res.status(401).json({ error: 'Parent PIN required', needPin: true });
    }
    next();
  };
}

module.exports = {
  FAMILY_COOKIE,
  PARENT_COOKIE,
  YEAR_MS,
  PARENT_WINDOW_MS,
  hashPin,
  verifyPin,
  generateFamilyCode,
  normalizeFamilyCode,
  cookieOptions,
  makeRequireFamily,
  makeRequireParent,
};
