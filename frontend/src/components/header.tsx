"use client"

import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = () => {
    signOut()
    router.push("/")
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-foreground">
          Tap Times
        </Link>
        <nav className="flex items-center gap-6">
          {user ? (
            <>
              <Link href="/dashboard" className="text-foreground hover:text-primary transition">
                Dashboard
              </Link>
              <Link href="/history" className="text-foreground hover:text-primary transition">
                History
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-sm">@{user.username}</span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition">
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
