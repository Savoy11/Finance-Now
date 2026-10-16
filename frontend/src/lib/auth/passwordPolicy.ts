// What a password must be, in one place for sign-up, the reset route and the reset page
// (T-435). No imports, so the browser bundle can use it without pulling in node:crypto.

export const MIN_PASSWORD_LENGTH = 10

/** Null when the password is acceptable; otherwise what is wrong with it, for the person. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  return null
}
