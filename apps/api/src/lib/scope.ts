import type { AuthUser } from '../middleware/auth.js';

/**
 * Tenant + ownership scoping, in one place.
 *
 * Filtering by `companyId` alone is not enough: agents must only ever reach
 * their OWN records. Applying this to list queries but not to by-id lookups is
 * how one agent ends up able to read — and edit — another agent's lead just by
 * knowing its id, so every query that touches these collections goes through here.
 */

/** Leads an agent owns are the ones assigned to them. */
export function leadScope(user: AuthUser): Record<string, unknown> {
  return user.role === 'agent'
    ? { companyId: user.companyId, assignedUser: user.id }
    : { companyId: user.companyId };
}

/** Schedules and calls are owned by the user who created them. */
export function ownedScope(user: AuthUser): Record<string, unknown> {
  return user.role === 'agent'
    ? { companyId: user.companyId, userId: user.id }
    : { companyId: user.companyId };
}
