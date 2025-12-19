"use client"

import { Share2, Link2, Twitter, Linkedin } from "lucide-react"
import { useState, useRef, useEffect } from "react"

interface ShareMenuProps {
  url: string
  title?: string
}

export function ShareMenu({ url, title }: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const shareText = title || "Check out this announcement on Speedy Finance AI"

  const shareOptions = [
    {
      name: "Copy Link",
      icon: Link2,
      onClick: () => {
        navigator.clipboard.writeText(url)
        setIsOpen(false)
      },
    },
    {
      name: "Twitter",
      icon: Twitter,
      onClick: () => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`, "_blank")
        setIsOpen(false)
      },
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      onClick: () => {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank")
        setIsOpen(false)
      },
    },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
        title="Share"
      >
        <Share2 className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-zinc-900 border border-white/10 shadow-xl z-50">
          <div className="py-1">
            {shareOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.name}
                  onClick={option.onClick}
                  className="w-full px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span>{option.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
