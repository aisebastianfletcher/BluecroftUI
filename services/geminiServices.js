// Re-export shim to ensure bundlers that prefer resolving .js will find the module.
// This file delegates to the TypeScript implementation geminiService.ts
export * from './geminiService';
export { default } from './geminiService';
