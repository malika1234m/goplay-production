/** Where each kind of account lands after signing in. */
export function roleHome(role: string | null | undefined, mustChangePassword?: boolean): string {
  if (mustChangePassword) return "/force-change-password";
  switch (role) {
    case "ADMIN":         return "/admin/dashboard";
    case "GROUND_OWNER":  return "/ground-owner/dashboard";
    case "GROUND_WORKER": return "/worker/dashboard";
    default:              return "/dashboard";
  }
}
