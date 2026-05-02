// ============================================================
// SmartRoll — Utils Re-export Shim
// Utility functions live in src/utils/helpers.ts.
// This file exists only for backward compatibility.
// Prefer importing directly from src/utils/helpers.
// ============================================================

export {
  formatDate,
  getTodayISO,
  isValidEmail,
  validateLoginForm,
  haversineDistance,
  round1dp,
  formatDisplayDate,
  formatTime,
  computeFaceVector,
  cosineSimilarity,
} from '../src/utils/helpers';
