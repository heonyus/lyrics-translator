#!/usr/bin/env node

// Script to verify API keys are properly configured
// Run with: node check-api-keys.js

import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🔑 Checking API Keys Configuration\n');
console.log('='.repeat(60));

const requiredKeys = [
  { name: 'OPENAI_API_KEY', service: 'OpenAI (GPT)' },
  { name: 'PERPLEXITY_API_KEY', service: 'Perplexity' },
  { name: 'ANTHROPIC_API_KEY', service: 'Anthropic (Claude)' },
  { name: 'GOOGLE_API_KEY', service: 'Google (Gemini)' },
  { name: 'GROQ_API_KEY', service: 'Groq' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', service: 'Supabase URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', service: 'Supabase Anon Key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', service: 'Supabase Service Role' },
];

console.log('📋 Environment Variables:\n');

let missingKeys = [];
let foundKeys = [];

for (const key of requiredKeys) {
  const value = process.env[key.name];
  if (value) {
    // Show first 10 chars of key for verification (masked)
    const masked = value.substring(0, 10) + '...' + value.substring(value.length - 4);
    console.log(`  ✅ ${key.service}: ${masked}`);
    foundKeys.push(key.name);
  } else {
    console.log(`  ❌ ${key.service}: NOT FOUND`);
    missingKeys.push(key.name);
  }
}

console.log('\n' + '='.repeat(60));

// Check for encrypted secrets file
const encryptedFile = '.secrets.enc.json';
if (existsSync(encryptedFile)) {
  console.log('\n🔐 Encrypted Secrets File:');
  console.log(`  ✅ ${encryptedFile} exists`);
  
  // Check if master password is set
  if (process.env.MASTER_PASSWORD) {
    console.log('  ✅ MASTER_PASSWORD is set');
  } else {
    console.log('  ⚠️  MASTER_PASSWORD not set (needed for decryption)');
  }
} else {
  console.log('\n🔐 Encrypted Secrets File:');
  console.log(`  ⚠️  ${encryptedFile} not found`);
}

console.log('\n' + '='.repeat(60));

// Summary
console.log('\n📊 Summary:');
console.log(`  - Found: ${foundKeys.length}/${requiredKeys.length} keys`);
console.log(`  - Missing: ${missingKeys.length} keys`);

if (missingKeys.length > 0) {
  console.log('\n⚠️  Missing Keys:');
  missingKeys.forEach(key => {
    console.log(`  - ${key}`);
  });
  
  console.log('\n💡 How to fix:');
  console.log('  1. Add missing keys to .env.local file');
  console.log('  2. Or use encrypted secrets file with:');
  console.log('     npm run write-secrets');
  console.log('  3. Or add to Supabase secure_secrets table');
} else {
  console.log('\n✨ All required API keys are configured!');
}

console.log('\n' + '='.repeat(60));

// Test API key loading from secure-secrets
console.log('\n🔄 Testing Secure Secrets Loading...\n');

try {
  // Import the module dynamically
  const secretsModule = await import('./src/lib/secure-secrets.js');
  const { getSecret } = secretsModule;
  
  const testServices = ['openai', 'perplexity', 'anthropic', 'google', 'groq'];
  
  for (const service of testServices) {
    try {
      const key = await getSecret(service, 'api_key');
      if (key) {
        const masked = key.substring(0, 10) + '...' + key.substring(key.length - 4);
        console.log(`  ✅ ${service}: Loaded successfully (${masked})`);
      } else {
        console.log(`  ❌ ${service}: Could not load`);
      }
    } catch (error) {
      console.log(`  ❌ ${service}: Error - ${error.message}`);
    }
  }
} catch (error) {
  console.log('  ⚠️  Could not test secure secrets loading');
  console.log(`     Error: ${error.message}`);
  console.log('     (This is normal if running outside of Next.js environment)');
}

console.log('\n' + '='.repeat(60));
console.log('✨ API Key Check Complete!\n');