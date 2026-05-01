import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, role } = await req.json();

    if (!name || !email || !password) {
      return Response.json({ error: "Name, email and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const userRole = role === "GROUND_OWNER" ? "GROUND_OWNER" : "USER";

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashed,
        phone: phone || null,
        role: userRole,
        ...(userRole === "GROUND_OWNER" && {
          groundOwnerProfile: {
            create: { businessName: name },
          },
        }),
      },
    });

    return Response.json({ message: "Account created successfully.", userId: user.id }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
