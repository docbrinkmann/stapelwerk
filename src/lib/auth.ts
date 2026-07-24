import { getServerSession } from "next-auth/next"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import { verifyPassword } from "./password"
import { isLockedOut, recordFailure, recordSuccess } from "./auth-throttle"

/**
 * NextAuth configuration: credentials (email + password) against the users
 * table, JWT sessions carrying the user id for the tRPC context.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email.toLowerCase().trim()
        // Throttle online brute force / credential stuffing per email.
        if (isLockedOut(email)) return null
        const user = await prisma.users.findUnique({ where: { email } })
        if (!user?.passwordHash || !verifyPassword(credentials.password, user.passwordHash)) {
          recordFailure(email)
          return null
        }
        recordSuccess(email)
        return { id: user.id, email: user.email, name: user.name, role: (user as any).role ?? 'user' }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = (user as any).id
        token.role = (user as any).role ?? 'user'
      }
      // useSession().update() after a profile edit: refresh name + role from the DB
      if (trigger === "update" && token.userId) {
        const dbUser = await prisma.users.findUnique({
          where: { id: token.userId as string },
          select: { name: true, role: true },
        })
        if (dbUser) {
          token.name = dbUser.name
          token.role = (dbUser as any).role ?? 'user'
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId
        ;(session.user as any).role = token.role ?? 'user'
      }
      return session
    },
  },
}

// Backwards-compatible aliases (older imports used these names)
export const defaultAuthOptions = authOptions
export const auth = authOptions

export const getPageSession = () => getServerSession(authOptions)
