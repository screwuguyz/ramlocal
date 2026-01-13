// Next.js instrumentation - runs once at server startup
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate environment variables on server startup
    await import('./lib/envValidation');
  }
}
