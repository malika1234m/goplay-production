import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /** What authorize() returns for a credentials sign-in */
  interface User {
    role?: string;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}
