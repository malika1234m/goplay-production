import { getSetting } from "@/lib/settings";

// Public endpoint — no auth required
// Returns maintenance mode status and minimum required app version
export async function GET() {
  try {
    const [maintenance, maintenanceMessage, minAppVersion] = await Promise.all([
      getSetting("maintenance"),
      getSetting("maintenanceMessage"),
      getSetting("minAppVersion"),
    ]);

    return Response.json({
      maintenance:        maintenance === "true",
      maintenanceMessage: maintenanceMessage ?? "We're performing scheduled maintenance. We'll be back shortly.",
      minAppVersion:      minAppVersion ?? "1.0.0",
    });
  } catch (err) {
    console.error("[GET /api/app-config]", err);
    // Fail open — never block users due to a config fetch error
    return Response.json({
      maintenance:        false,
      maintenanceMessage: "",
      minAppVersion:      "1.0.0",
    });
  }
}
