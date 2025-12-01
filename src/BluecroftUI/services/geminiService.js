// JS shim (explicit .mjs) to ensure CI/Vite resolves the module.
// Delegates to the TypeScript implementation geminiService.ts
export * from './geminiService';
export { default } from './geminiService';
