import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

/**
 * The small shared building blocks of the conversation: Nestor's avatar (the
 * same mark next to every assistant turn, the live trace and the typing
 * indicator), the user's chat bubble, and the three-dot thinking indicator.
 */

/** Nestor's avatar — leads every assistant-side row so turns scan consistently. */
export function NestorAvatar() {
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
      <Sparkles className="size-4" />
    </div>
  )
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] cursor-text select-text rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground selection:bg-primary-foreground/30 selection:text-primary-foreground">
        {text}
      </p>
    </div>
  )
}

export function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <NestorAvatar />
      <div className="flex items-center gap-1 pt-2.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  )
}
