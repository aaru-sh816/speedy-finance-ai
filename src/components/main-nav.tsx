"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function MainNav() {
  const pathname = usePathname()

  const items = [
    { href: "/announcements", label: "Announcements" },
    { href: "/screener", label: "Screener" },
    { href: "/bulk-deals", label: "Bulk Deals" },
    { href: "/corporate-actions", label: "Corporate Actions" },
  ]

  return (
    <div className="flex gap-6 md:gap-10">
      <Link href="/" className="flex items-center space-x-2">
        <span className="inline-block font-bold">Speedy Finance AI</span>
      </Link>
      <nav className="hidden gap-6 md:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center text-sm font-medium text-zinc-500 hover:text-foreground transition-colors",
              pathname === item.href && "text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
