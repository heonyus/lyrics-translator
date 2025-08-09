#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

console.log('\n🔍 ===== API KEY STATUS CHECK =====');
console.log('Time:', new Date().toISOString());
console.log('=====================================\n');

// Test functions
async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return { name: 'OpenAI', hasKey: false, status: 'no_key' };
  }

  console.log('🔄 Testing OpenAI...');
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.status === 429) {
      const error = await response.json();
      return { 
        name: 'OpenAI', 
        hasKey: true, 
        status: 'quota_exceeded', 
        message: error.error?.message || 'Quota exceeded'
      };
    }

    if (response.ok) {
      const data = await response.json();
      const gptModels = data.data?.filter(m => m.id.includes('gpt')) || [];
      return { 
        name: 'OpenAI', 
        hasKey: true, 
        status: 'success', 
        models: gptModels.slice(0, 5).map(m => m.id)
      };
    }

    return { 
      name: 'OpenAI', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}` 
    };
  } catch (error) {
    return { 
      name: 'OpenAI', 
      hasKey: true, 
      status: 'error', 
      message: error.message 
    };
  }
}

async function testClaude() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return { name: 'Claude', hasKey: false, status: 'no_key' };
  }

  console.log('🔄 Testing Claude...');
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      }),
    });

    if (response.status === 400) {
      const error = await response.json();
      if (error.error?.message?.includes('credit balance')) {
        return { 
          name: 'Claude', 
          hasKey: true, 
          status: 'quota_exceeded', 
          message: 'Credit balance too low' 
        };
      }
    }

    if (response.ok) {
      return { 
        name: 'Claude', 
        hasKey: true, 
        status: 'success'
      };
    }

    const errorText = await response.text();
    return { 
      name: 'Claude', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
    };
  } catch (error) {
    return { 
      name: 'Claude', 
      hasKey: true, 
      status: 'error', 
      message: error.message 
    };
  }
}

async function testGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return { name: 'Groq', hasKey: false, status: 'no_key' };
  }

  console.log('🔄 Testing Groq...');
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });

    if (response.status === 429) {
      return { 
        name: 'Groq', 
        hasKey: true, 
        status: 'rate_limit', 
        message: 'Rate limit - wait and retry' 
      };
    }

    if (response.ok) {
      const data = await response.json();
      return { 
        name: 'Groq', 
        hasKey: true, 
        status: 'success',
        model: data.model
      };
    }

    return { 
      name: 'Groq', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}` 
    };
  } catch (error) {
    return { 
      name: 'Groq', 
      hasKey: true, 
      status: 'error', 
      message: error.message 
    };
  }
}

async function testPerplexity() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    return { name: 'Perplexity', hasKey: false, status: 'no_key' };
  }

  console.log('🔄 Testing Perplexity...');
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });

    if (response.status === 429) {
      return { 
        name: 'Perplexity', 
        hasKey: true, 
        status: 'rate_limit'
      };
    }

    if (response.ok) {
      const data = await response.json();
      return { 
        name: 'Perplexity', 
        hasKey: true, 
        status: 'success',
        model: data.model
      };
    }

    return { 
      name: 'Perplexity', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}` 
    };
  } catch (error) {
    return { 
      name: 'Perplexity', 
      hasKey: true, 
      status: 'error', 
      message: error.message 
    };
  }
}

async function testGemini() {
  const apiKey = process.env.GOOGLE_API_KEY || 
                 process.env.GEMINI_API_KEY ||
                 process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  
  if (!apiKey) {
    return { name: 'Gemini', hasKey: false, status: 'no_key' };
  }

  console.log('🔄 Testing Gemini...');
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10,
          },
        }),
      }
    );

    if (response.status === 429) {
      const error = await response.json();
      return { 
        name: 'Gemini', 
        hasKey: true, 
        status: 'quota_exceeded', 
        message: error.error?.message || 'Quota exceeded' 
      };
    }

    if (response.ok) {
      return { 
        name: 'Gemini', 
        hasKey: true, 
        status: 'success'
      };
    }

    const errorText = await response.text();
    const errorJson = JSON.parse(errorText);
    return { 
      name: 'Gemini', 
      hasKey: true, 
      status: 'error', 
      message: errorJson.error?.message || `HTTP ${response.status}` 
    };
  } catch (error) {
    return { 
      name: 'Gemini', 
      hasKey: true, 
      status: 'error', 
      message: error.message 
    };
  }
}

// Run all tests
async function runTests() {
  const results = await Promise.all([
    testOpenAI(),
    testClaude(),
    testGroq(),
    testPerplexity(),
    testGemini(),
  ]);

  // Display results
  console.log('\n📊 API TEST RESULTS:');
  console.log('=====================================');
  
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'quota_exceeded' ? '⚠️' : 
                 result.status === 'rate_limit' ? '🔄' :
                 result.status === 'no_key' ? '❌' : '💥';
    
    console.log(`\n${icon} ${result.name}:`);
    console.log(`   Key: ${result.hasKey ? '✓ Found' : '✗ Missing'}`);
    console.log(`   Status: ${result.status}`);
    
    if (result.message) {
      console.log(`   Message: ${result.message}`);
    }
    if (result.models) {
      console.log(`   Models: ${result.models.join(', ')}`);
    }
    if (result.model) {
      console.log(`   Model: ${result.model}`);
    }
  });

  // Summary
  const summary = {
    working: results.filter(r => r.status === 'success'),
    quota_exceeded: results.filter(r => r.status === 'quota_exceeded'),
    rate_limited: results.filter(r => r.status === 'rate_limit'),
    no_key: results.filter(r => r.status === 'no_key'),
    error: results.filter(r => r.status === 'error'),
  };

  console.log('\n=====================================');
  console.log('📈 SUMMARY:');
  console.log(`   ✅ Working: ${summary.working.map(r => r.name).join(', ') || 'None'}`);
  console.log(`   ⚠️ Quota Exceeded: ${summary.quota_exceeded.map(r => r.name).join(', ') || 'None'}`);
  console.log(`   🔄 Rate Limited: ${summary.rate_limited.map(r => r.name).join(', ') || 'None'}`);
  console.log(`   ❌ No Key: ${summary.no_key.map(r => r.name).join(', ') || 'None'}`);
  console.log(`   💥 Error: ${summary.error.map(r => r.name).join(', ') || 'None'}`);
  console.log('=====================================\n');

  // Recommendations
  if (summary.working.length === 0) {
    console.log('⚠️  WARNING: No APIs are currently working!');
    console.log('   Lyrics search functionality will be severely limited.');
  } else if (summary.working.length < 3) {
    console.log('⚠️  WARNING: Only ' + summary.working.length + ' API(s) working.');
    console.log('   Consider adding more API keys for better reliability.');
  }

  if (summary.quota_exceeded.length > 0) {
    console.log('\n💳 QUOTA ISSUES:');
    summary.quota_exceeded.forEach(r => {
      console.log(`   - ${r.name}: ${r.message || 'Quota exceeded'}`);
    });
  }

  if (summary.rate_limited.length > 0) {
    console.log('\n⏱️  RATE LIMIT ISSUES:');
    console.log('   These APIs are temporarily rate limited. Wait a moment and retry.');
  }
}

// Execute
runTests().catch(console.error);