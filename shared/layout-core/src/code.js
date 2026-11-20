/**
 * Code Normalization, Validation, and Location Pattern Generator
 * Pure functions shared across frontend and backend.
 */

const VALID_CODE_REGEX = /^[A-Z0-9_-]+$/;
const DEFAULT_PATTERN = '{aisle}-{rack}-{bay}-{level}-{position}';

/**
 * Normalizes a raw code string:
 * - Trims leading and trailing whitespace
 * - Converts to uppercase
 *
 * @param {string} rawCode
 * @returns {string}
 */
function normalizeCode(rawCode) {
  if (typeof rawCode !== 'string') {
    return '';
  }
  return rawCode.trim().toUpperCase();
}

/**
 * Validates whether a code adheres to the alphanumeric format standard.
 *
 * @param {string} code
 * @param {number} [maxLength=60]
 * @returns {boolean}
 */
function isValidCode(code, maxLength = 60) {
  if (!code || typeof code !== 'string') return false;
  const normalized = normalizeCode(code);
  if (normalized.length === 0 || normalized.length > maxLength) return false;
  return VALID_CODE_REGEX.test(normalized);
}

/**
 * Pads a number or string with leading zeros.
 * @param {number|string} val
 * @param {number} [width=2]
 * @returns {string}
 */
function padZero(val, width = 2) {
  return String(val).padStart(width, '0');
}

/**
 * Renders a location code string based on pattern template and segments.
 *
 * @param {Object} segments
 * @param {string} [segments.aisle='A']
 * @param {string|number} [segments.rack='01']
 * @param {number} [segments.bay=1]
 * @param {number} [segments.level=1]
 * @param {number} [segments.position=1]
 * @param {string} [pattern=DEFAULT_PATTERN]
 * @param {string} [separator='-']
 * @returns {string} Normalized formatted location code
 */
function renderPattern(segments, pattern = DEFAULT_PATTERN, separator = '-') {
  const aisle = normalizeCode(segments.aisle || 'A');
  const rack = typeof segments.rack === 'number' ? padZero(segments.rack, 2) : normalizeCode(String(segments.rack || '01'));
  const bay = padZero(segments.bay || 1, 2);
  const level = padZero(segments.level || 1, 2);
  const position = padZero(segments.position || 1, 2);

  let result = pattern
    .replace(/\{aisle\}/gi, aisle)
    .replace(/\{rack\}/gi, rack)
    .replace(/\{bay\}/gi, bay)
    .replace(/\{level\}/gi, level)
    .replace(/\{position\}/gi, position);

  if (separator !== '-') {
    result = result.replace(/-/g, separator);
  }

  return normalizeCode(result);
}

/**
 * Validates whether a pattern string is valid and contains required location segment placeholders.
 * @param {string} pattern
 * @returns {{ valid: boolean, missingTokens: string[] }}
 */
function validatePattern(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, missingTokens: ['all'] };
  }

  const requiredTokens = ['{aisle}', '{rack}', '{bay}', '{level}', '{position}'];
  const lowerPattern = pattern.toLowerCase();
  const missingTokens = requiredTokens.filter((token) => !lowerPattern.includes(token));

  return {
    valid: missingTokens.length === 0,
    missingTokens,
  };
}

export {
  VALID_CODE_REGEX,
  DEFAULT_PATTERN,
  normalizeCode,
  isValidCode,
  padZero,
  renderPattern,
  validatePattern,
};

export default {
  VALID_CODE_REGEX,
  DEFAULT_PATTERN,
  normalizeCode,
  isValidCode,
  padZero,
  renderPattern,
  validatePattern,
};
