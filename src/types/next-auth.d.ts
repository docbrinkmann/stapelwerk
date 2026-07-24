import { DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Extends the built-in session types to include custom user properties
   */
  interface Session extends DefaultSession {
    user: {
      id: string
      isAdmin?: boolean
    } & DefaultSession["user"]
  }

  /**
   * Extends the built-in user types to include custom properties
   */
  interface User {
    id: string
    isAdmin?: boolean
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the built-in JWT types to include custom properties
   */
  interface JWT {
    id: string
    isAdmin?: boolean
  }
}
