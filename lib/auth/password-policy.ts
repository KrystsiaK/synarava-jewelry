export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; error: string };

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (!password || password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: "Password must contain at least one uppercase letter (A–Z)." };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: "Password must contain at least one lowercase letter (a–z)." };
  }
  if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, error: "Password must contain at least one number or special character." };
  }
  return { ok: true };
}
