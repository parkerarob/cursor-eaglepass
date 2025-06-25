/**
 * Temporary barrel that simply re-exports the existing monolith while we refactor.
 * Every file that now does `import { … } from "src/lib/validation"` will still work.
 *
 * Phase-5 will flip these exports to the new sub-modules.
 */

export * from './sanitiser';
export * from './guards';
export * from './schemas';
export * from './service';
