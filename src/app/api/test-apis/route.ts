import { NextResponse } from 'next/server';
import { getSecret } from '@/lib/secure-secrets';

interface APITestResult {
  name: string;
  hasKey: boolean;
  status: 'success' | 'error' | 'quota_exceeded' | 'no_key';
  message?: string;
  response?: any;
}

async function testOpenAI(): Promise<APITestResult> {
  const apiKey = await getSecret('openai', 'api_key') || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return { name: 'OpenAI', hasKey: false, status: 'no_key', message: 'No API key found' };
  }

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
      const gptModels = data.data?.filter((m: any) => m.id.includes('gpt')) || [];
      return { 
        name: 'OpenAI', 
        hasKey: true, 
        status: 'success', 
        message: `Found ${gptModels.length} GPT models`,
        response: gptModels.map((m: any) => m.id)
      };
    }

    return { 
      name: 'OpenAI', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}: ${response.statusText}` 
    };
  } catch (error) {
    return { 
      name: 'OpenAI', 
      hasKey: true, 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testClaude(): Promise<APITestResult> {
  const apiKey = await getSecret('anthropic', 'api_key') || 
                 process.env.CLAUDE_API_KEY || 
                 process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return { name: 'Claude', hasKey: false, status: 'no_key', message: 'No API key found' };
  }

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
        status: 'success', 
        message: 'API is working' 
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
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testGroq(): Promise<APITestResult> {
  const apiKey = await getSecret('groq', 'api_key') || process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return { name: 'Groq', hasKey: false, status: 'no_key', message: 'No API key found' };
  }

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
        status: 'quota_exceeded', 
        message: 'Rate limit exceeded - too many requests' 
      };
    }

    if (response.ok) {
      const data = await response.json();
      return { 
        name: 'Groq', 
        hasKey: true, 
        status: 'success', 
        message: `Model: ${data.model || 'unknown'}` 
      };
    }

    const errorText = await response.text();
    return { 
      name: 'Groq', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
    };
  } catch (error) {
    return { 
      name: 'Groq', 
      hasKey: true, 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testPerplexity(): Promise<APITestResult> {
  const apiKey = await getSecret('perplexity', 'api_key') || process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    return { name: 'Perplexity', hasKey: false, status: 'no_key', message: 'No API key found' };
  }

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
        status: 'quota_exceeded', 
        message: 'Rate limit exceeded' 
      };
    }

    if (response.ok) {
      const data = await response.json();
      return { 
        name: 'Perplexity', 
        hasKey: true, 
        status: 'success', 
        message: `Model: ${data.model || 'unknown'}` 
      };
    }

    const errorText = await response.text();
    return { 
      name: 'Perplexity', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
    };
  } catch (error) {
    return { 
      name: 'Perplexity', 
      hasKey: true, 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function testGemini(): Promise<APITestResult> {
  const apiKey = await getSecret('google', 'api_key') || 
                 process.env.GOOGLE_API_KEY || 
                 process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  
  if (!apiKey) {
    return { name: 'Gemini', hasKey: false, status: 'no_key', message: 'No API key found' };
  }

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
      const data = await response.json();
      return { 
        name: 'Gemini', 
        hasKey: true, 
        status: 'success', 
        message: 'API is working' 
      };
    }

    const errorText = await response.text();
    return { 
      name: 'Gemini', 
      hasKey: true, 
      status: 'error', 
      message: `HTTP ${response.status}: ${errorText.substring(0, 100)}` 
    };
  } catch (error) {
    return { 
      name: 'Gemini', 
      hasKey: true, 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function GET() {
  console.log('\n🔍 ===== API TEST STARTED =====');
  console.log('Time:', new Date().toISOString());
  console.log('Testing all LLM APIs...\n');

  const results = await Promise.all([
    testOpenAI(),
    testClaude(),
    testGroq(),
    testPerplexity(),
    testGemini(),
  ]);

  // Console output with colors
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'quota_exceeded' ? '⚠️' : 
                 result.status === 'no_key' ? '❌' : '💥';
    
    console.log(`${icon} ${result.name}:`);
    console.log(`   Key: ${result.hasKey ? 'Found' : 'Missing'}`);
    console.log(`   Status: ${result.status}`);
    if (result.message) {
      console.log(`   Message: ${result.message}`);
    }
    if (result.response) {
      console.log(`   Response:`, result.response);
    }
    console.log('');
  });

  const summary = {
    working: results.filter(r => r.status === 'success').map(r => r.name),
    quota_exceeded: results.filter(r => r.status === 'quota_exceeded').map(r => r.name),
    no_key: results.filter(r => r.status === 'no_key').map(r => r.name),
    error: results.filter(r => r.status === 'error').map(r => r.name),
  };

  console.log('📊 SUMMARY:');
  console.log(`   Working: ${summary.working.join(', ') || 'None'}`);
  console.log(`   Quota Exceeded: ${summary.quota_exceeded.join(', ') || 'None'}`);
  console.log(`   No Key: ${summary.no_key.join(', ') || 'None'}`);
  console.log(`   Error: ${summary.error.join(', ') || 'None'}`);
  console.log('\n===== API TEST COMPLETED =====\n');

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
    summary,
  });
}