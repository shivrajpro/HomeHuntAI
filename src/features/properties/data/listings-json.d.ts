/**
 * Type the large seed JSON as `unknown` so the TypeScript compiler doesn't
 * infer a multi-megabyte literal type from it (which is slow and memory-heavy).
 * The real shape is enforced at runtime by the Zod schema in `listings.ts`.
 */
declare module '*/listings.json' {
  const value: unknown
  export default value
}
