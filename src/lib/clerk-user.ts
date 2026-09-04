/**
 * Pure helpers for reading Clerk user objects. No Clerk import so the
 * functions are trivially unit-testable and usable from any runtime.
 */

// Minimal structural shape shared by Clerk's backend `User` (from
// `currentUser()` / `clerkClient().users.getUser()`) and the frontend
// `UserResource`. Only the fields this helper reads are declared.
export type EmailLike = {
  id?: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
} | null;

export type UserLike = {
  primaryEmailAddressId?: string | null;
  primaryEmailAddress?: EmailLike;
  emailAddresses?: EmailLike[];
} | null;

/**
 * The user's primary email, but only when Clerk has verified it.
 *
 * Why not `emailAddresses[0]`: Clerk does not order that array by primary,
 * and a user can add an unverified secondary address. Because the account
 * page links guest orders to an account by email, an unverified address
 * would let someone claim another shopper's order history. Returns null
 * when there is no primary address or it is not verified.
 */
export function getVerifiedPrimaryEmail(user: UserLike | undefined) {
  if (!user) return null;
  const primary =
    user.primaryEmailAddress ??
    user.emailAddresses?.find(
      (e) => e?.id != null && e.id === user.primaryEmailAddressId,
    ) ??
    null;
  if (!primary?.emailAddress) return null;
  if (primary.verification?.status !== "verified") return null;
  return primary.emailAddress;
}
