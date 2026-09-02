/**
 * Product feature flags for Lectern.
 *
 * Flip these in source when reversing a shipped product rule without a large rewrite.
 */

/**
 * When true, PDF / LCT1 restore may reopen the teacher tab (legacy shared-document behavior).
 * When false, PDF restore stays a student session; authoring reopens from a `.lectern`
 * file or this device’s teacher draft only.
 */
export const ALLOW_PDF_RESTORE_AUTHORING = true;
