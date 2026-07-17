import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { ArrowRight, MapPin, ScanSearch, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/lib/use-document-title'

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Smart matching',
    body: 'Describe your life, not filters. The copilot ranks homes by how well they actually fit you.',
  },
  {
    icon: MapPin,
    title: 'Neighborhood intel',
    body: 'Commute, noise, walkability and vibe — synthesized into one honest read per listing.',
  },
  {
    icon: Sparkles,
    title: 'Decision copilot',
    body: 'Compare, stress-test trade-offs, and get a clear recommendation you can trust.',
  },
] as const

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export function HomePage() {
  useDocumentTitle('HomeHunt AI — Find the home that fits your life')
  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card px-6 py-16 shadow-elevated sm:px-12 sm:py-24">
        {/* Ambient accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative mx-auto max-w-2xl text-center"
        >
          <motion.span
            variants={item}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <Sparkles className="size-3 text-primary" />
            Your AI home decision copilot
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl"
          >
            Find the home that
            <span className="text-primary"> fits your life</span>.
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground"
          >
            HomeHunt AI reads listings, neighborhoods, and your priorities — then
            helps you decide with confidence, not spreadsheets.
          </motion.p>

          <motion.div
            variants={item}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg">
              <Link to="/copilot">
                Start with the copilot
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/explore">Browse homes</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <section>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="grid gap-4 sm:grid-cols-3"
        >
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <motion.div
              key={title}
              variants={item}
              className="group rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  )
}
