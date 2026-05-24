import { NextRequest } from "next/server";
import { getSession } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import Expo from "expo-server-sdk";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token || !Expo.isExpoPushToken(token)) {
      return Response.json({ error: "Invalid push token." }, { status: 400 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data:  { pushToken: token },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/push-token]", err);
    return Response.json({ error: "Failed to save push token." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data:  { pushToken: null },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/push-token]", err);
    return Response.json({ error: "Failed to remove push token." }, { status: 500 });
  }
}
