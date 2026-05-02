// ============================================================
// SmartRoll — Password Validation Rules
// Defines the set of password strength rules used across all
// sign-up and password-change flows. Each rule has a test
// function so the UI can show per-rule pass/fail indicators.
// ============================================================

/** A single password strength rule */
export interface PasswordRule {
  /** Unique identifier for this rule */
  id: string;
  /** Human-readable description shown in the UI */
  label: string;
  /**
   * Returns true if the password satisfies this rule.
   * @param password - the password string to test
   */
  test: (password: string) => boolean;
}

/** The full set of password rules enforced by SmartRoll */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length',  label: 'At least 8 characters',           test: (p) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter',             test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter',             test: (p) => /[a-z]/.test(p) },
  { id: 'number',  label: 'One number',                       test: (p) => /\d/.test(p) },
  { id: 'special', label: 'One special character (!@#$...)',  test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/**
 * Validates a password against all PASSWORD_RULES.
 * @param password - the password string to validate
 * @returns `{ valid: boolean, failed: string[] }` where `failed` is the list of rule IDs that did not pass
 */
export function validatePassword(password: string): { valid: boolean; failed: string[] } {
  const failed = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.id);
  return { valid: failed.length === 0, failed };
}

/** Password strength tier */
export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong';

/**
 * Derives a strength tier from the number of rules passed.
 * @param password - the password string to evaluate
 * @returns a PasswordStrength tier
 */
export function getStrength(password: string): PasswordStrength {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return 'weak';
  if (passed === 2) return 'fair';
  if (passed === 3 || passed === 4) return 'strong';
  return 'very-strong';
}

/** Human-readable labels for each strength tier */
export const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  'very-strong': 'Very Strong',
};

/** Colours used to render the strength bar for each tier */
export const STRENGTH_COLORS: Record<PasswordStrength, string> = {
  weak: '#A32D2D',
  fair: '#BA7517',
  strong: '#185FA5',
  'very-strong': '#1A6641',
};
