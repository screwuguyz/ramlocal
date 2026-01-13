// Environment variable validation
// This runs at server startup to ensure all required env vars are present

const requiredEnvVars = {
  // Authentication
  ADMIN_EMAIL: 'Admin email for login',
  ADMIN_PASSWORD: 'Admin password (can be plain text or bcrypt hash)',

  // Supabase (required for multi-device sync)
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase project URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase anon/public key',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key (for server-side operations)',
} as const;

const optionalEnvVars = {
  // Optional features
  PUSHOVER_TOKEN: 'Pushover API token for push notifications',
  OPENAI_API_KEY: 'OpenAI API key for AI explanations',
  GROQ_API_KEY: 'Groq API key (alternative to OpenAI)',
  ALLOWED_ORIGINS: 'Comma-separated list of allowed CORS origins',
} as const;

export function validateEnv() {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[key]) {
      missing.push(`${key}: ${description}`);
    }
  }

  // Check optional variables
  for (const [key, description] of Object.entries(optionalEnvVars)) {
    if (!process.env[key]) {
      warnings.push(`${key}: ${description} (optional)`);
    }
  }

  // In production, all required vars must be present
  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    console.error('\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:\n');
    missing.forEach(msg => console.error(`  - ${msg}`));
    console.error('\nPlease set these in your .env.local or deployment environment.\n');
    throw new Error('Missing required environment variables');
  }

  // In development, just warn
  if (process.env.NODE_ENV === 'development') {
    if (missing.length > 0) {
      console.warn('\n⚠️  MISSING REQUIRED ENVIRONMENT VARIABLES:\n');
      missing.forEach(msg => console.warn(`  - ${msg}`));
      console.warn('\nSome features may not work correctly.\n');
    }
    if (warnings.length > 0) {
      console.info('\nℹ️  Optional environment variables not set:');
      warnings.forEach(msg => console.info(`  - ${msg}`));
      console.info('');
    }
  }

  // Validate password format in production
  if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASSWORD) {
    const isBcrypt = /^\$2[aby]\$\d{2}\$.{53}$/.test(process.env.ADMIN_PASSWORD);
    if (!isBcrypt) {
      console.warn(
        '\n⚠️  WARNING: ADMIN_PASSWORD appears to be plain text in production!\n' +
        'Please hash it using bcrypt. The system will auto-migrate on first login,\n' +
        'but you should update .env with the bcrypt hash for security.\n'
      );
    }
  }

  return { missing, warnings };
}

// Run validation on module load (server startup)
if (typeof window === 'undefined') {
  // Only run on server
  validateEnv();
}
