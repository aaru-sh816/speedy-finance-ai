"use client"

import { motion, AnimatePresence } from "framer-motion"

export function AnimatedPrice({ value, className = "" }: { value: string | number, className?: string }) {
    const chars = String(value).split("")

    return (
        <div className={`flex overflow-hidden tabular-nums ${className}`}>
            <AnimatePresence mode="popLayout" initial={false}>
                {chars.map((char, i) => (
                    <motion.span
                        // Use character value and position from right (to handle length changes securely)
                        key={`${char}-${chars.length - i}`}
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "-100%", opacity: 0, filter: "blur(2px)" }}
                        transition={{ type: "spring", stiffness: 800, damping: 50, mass: 0.8 }}
                        className="inline-block"
                    >
                        {char}
                    </motion.span>
                ))}
            </AnimatePresence>
        </div>
    )
}
