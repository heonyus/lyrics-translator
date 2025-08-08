// Production-aware logger with environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// Enable debug logging
const DEBUG = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// Current log level from environment or default
const currentLogLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'INFO'];

// ANSI colors - disabled in production
const colors = isProduction || isVercel ? {
  // No colors in production
  reset: '',
  bright: '',
  dim: '',
  black: '',
  red: '',
  green: '',
  yellow: '',
  blue: '',
  magenta: '',
  cyan: '',
  white: '',
  gray: '',
  bgRed: '',
  bgGreen: '',
  bgYellow: '',
  bgBlue: '',
  bgMagenta: '',
  bgCyan: '',
} : {
  // Pretty colors for development
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

// Session tracking
let sessionStats = {
  startTime: Date.now(),
  apiCalls: new Map<string, { count: number; successes: number; failures: number; totalTime: number }>(),
  totalSearches: 0,
  cacheHits: 0,
  cacheMisses: 0
};

// Request ID for tracking in production
let requestCounter = 0;
function generateRequestId(): string {
  return `${Date.now()}-${++requestCounter}`;
}

// Production-safe logging function
function log(level: LogLevel, message: string, metadata?: any) {
  if (LOG_LEVELS[level] > currentLogLevel) return;
  
  if (isProduction || isVercel) {
    // Structured JSON logging for production
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: stripAnsiColors(message),
      ...(metadata && { metadata })
    };
    
    switch (level) {
      case 'ERROR':
        console.error(JSON.stringify(logEntry));
        break;
      case 'WARN':
        console.warn(JSON.stringify(logEntry));
        break;
      default:
        console.log(JSON.stringify(logEntry));
    }
  } else {
    // Pretty logging for development
    console.log(message);
  }
}

// Strip ANSI color codes for production
function stripAnsiColors(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export const logger = {
  // Start a new search session
  startSession: (searchQuery: string) => {
    if (isProduction || isVercel) {
      log('INFO', `Search session started: ${searchQuery}`, { 
        query: searchQuery,
        requestId: generateRequestId()
      });
    } else {
      const width = 80;
      const timestamp = new Date().toLocaleString('ko-KR');
      console.log('\n' + colors.cyan + '═'.repeat(width) + colors.reset);
      console.log(colors.cyan + '║' + colors.reset + colors.bright + colors.white + ' 🎵 LYRICS SEARCH SESSION'.padEnd(width - 2) + colors.reset + colors.cyan + '║' + colors.reset);
      console.log(colors.cyan + '╠' + '═'.repeat(width - 2) + '╣' + colors.reset);
      console.log(colors.cyan + '║' + colors.reset + ` 🔍 Query: ${colors.bright}${searchQuery}`.padEnd(width - 2 + colors.bright.length + colors.reset.length) + colors.cyan + '║' + colors.reset);
      console.log(colors.cyan + '║' + colors.reset + ` ⏰ Time: ${timestamp}`.padEnd(width - 2) + colors.cyan + '║' + colors.reset);
      console.log(colors.cyan + '╚' + '═'.repeat(width - 2) + '╝' + colors.reset);
    }
    
    sessionStats.totalSearches++;
  },
  
  search: (message: string) => {
    if (isProduction || isVercel) {
      log('INFO', `Search: ${message}`);
    } else {
      const icon = '🔍';
      const status = colors.bgMagenta + colors.white + ' SEARCH ' + colors.reset;
      console.log(`\n${icon} ${getTimestamp()} ${status} ${colors.magenta}${message}${colors.reset}`);
      console.log(colors.gray + '─'.repeat(60) + colors.reset);
    }
  },
  
  api: (apiName: string, status: 'start' | 'success' | 'fail' | 'skip' | 'fetch', details?: string) => {
    if (isProduction || isVercel) {
      const level: LogLevel = status === 'fail' ? 'ERROR' : status === 'skip' ? 'WARN' : 'INFO';
      log(level, `API ${apiName}: ${status}`, { api: apiName, status, details });
      
      // Still track stats in production
      if (!sessionStats.apiCalls.has(apiName)) {
        sessionStats.apiCalls.set(apiName, { count: 0, successes: 0, failures: 0, totalTime: 0 });
      }
      const stats = sessionStats.apiCalls.get(apiName)!;
      
      if (status === 'start') {
        stats.count++;
      } else if (status === 'success') {
        stats.successes++;
      } else if (status === 'fail') {
        stats.failures++;
      }
      return;
    }
    
    // Development logging continues below
    const icons = {
      start: '🚀',
      success: '✅',
      fail: '❌',
      skip: '⏭️',
      fetch: '🔄'
    };
    
    const statusColors = {
      start: colors.cyan,
      success: colors.green,
      fail: colors.red,
      skip: colors.yellow,
      fetch: colors.blue
    };
    
    const bgColors = {
      start: colors.bgCyan + colors.black,
      success: colors.bgGreen + colors.black,
      fail: colors.bgRed + colors.white,
      skip: colors.bgYellow + colors.black,
      fetch: colors.bgBlue + colors.white
    };
    
    // Track API stats
    if (!sessionStats.apiCalls.has(apiName)) {
      sessionStats.apiCalls.set(apiName, { count: 0, successes: 0, failures: 0, totalTime: 0 });
    }
    const stats = sessionStats.apiCalls.get(apiName)!;
    
    if (status === 'start') {
      stats.count++;
    } else if (status === 'success') {
      stats.successes++;
    } else if (status === 'fail') {
      stats.failures++;
    }
    
    const icon = icons[status];
    const color = statusColors[status];
    const bgColor = bgColors[status];
    const statusText = ` ${status.toUpperCase().padEnd(7)} `;
    const apiLabel = apiName.padEnd(20);
    
    // Extract timing from details if present
    const timeMatch = details?.match(/\((\d+)ms\)/);
    const timeStr = timeMatch ? colors.gray + ` [${timeMatch[1]}ms]` + colors.reset : '';
    
    console.log(
      `${icon} ${getTimestamp()} ${bgColor}${statusText}${colors.reset} ${colors.bright}${apiLabel}${colors.reset} ${color}${details || ''}${colors.reset}${timeStr}`
    );
    
    // Add visual indicators for special cases
    if (details?.includes('LRC') || details?.includes('synced')) {
      console.log(`   ${colors.gray}└─${colors.reset} ${colors.green}🎵 ${colors.bright}${colors.green}LRC Timestamps Available!${colors.reset}`);
    }
    if (details?.includes('chars')) {
      const lengthMatch = details.match(/(\d+) chars/);
      if (lengthMatch) {
        const length = parseInt(lengthMatch[1]);
        const quality = length > 2000 ? '📚' : length > 1000 ? '📖' : '📄';
        console.log(`   ${colors.gray}└─${colors.reset} ${quality} Length: ${colors.bright}${length}${colors.reset} characters`);
      }
    }
  },
  
  cache: (hit: boolean, details: string) => {
    if (hit) sessionStats.cacheHits++;
    else sessionStats.cacheMisses++;
    
    if (isProduction || isVercel) {
      log('INFO', `Cache ${hit ? 'hit' : 'miss'}: ${details}`, { cacheHit: hit });
    } else {
      const icon = hit ? '💎' : '🔄';
      const status = hit 
        ? colors.bgGreen + colors.black + ' CACHE HIT ' + colors.reset
        : colors.bgYellow + colors.black + ' CACHE MISS ' + colors.reset;
      const color = hit ? colors.green : colors.yellow;
      
      console.log(`\n${icon} ${getTimestamp()} ${status} ${color}${details}${colors.reset}`);
    }
  },
  
  db: (operation: 'save' | 'update' | 'fetch' | 'delete', details: string) => {
    if (isProduction || isVercel) {
      log('INFO', `DB ${operation}: ${details}`, { operation });
    } else {
      const icons = {
        save: '💾',
        update: '📝',
        fetch: '📚',
        delete: '🗑️'
      };
      
      const opColors = {
        save: colors.green,
        update: colors.blue,
        fetch: colors.cyan,
        delete: colors.red
      };
      
      const icon = icons[operation];
      const color = opColors[operation];
      const status = colors.bgBlue + colors.white + ` DB:${operation.toUpperCase()} ` + colors.reset;
      
      console.log(`${icon} ${getTimestamp()} ${status} ${color}${details}${colors.reset}`);
    }
  },
  
  result: (source: string, confidence: number, lyricsLength: number) => {
    if (isProduction || isVercel) {
      log('INFO', `Result from ${source}`, { source, confidence, lyricsLength });
      return;
    }
    
    // Confidence visualization
    const percentage = Math.floor(confidence * 100);
    const stars = Math.floor(confidence * 5);
    
    let qualityEmoji = '😟';
    let qualityColor = colors.red;
    
    if (confidence >= 0.9) {
      qualityEmoji = '🌟';
      qualityColor = colors.green;
    } else if (confidence >= 0.7) {
      qualityEmoji = '⭐';
      qualityColor = colors.yellow;
    } else if (confidence >= 0.5) {
      qualityEmoji = '💫';
      qualityColor = colors.cyan;
    }
    
    // Create confidence bar
    const barLength = 20;
    const filled = Math.floor(confidence * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    console.log('\n' + colors.bgGreen + colors.black + ' 📊 RESULT ' + colors.reset);
    console.log(`   ${colors.cyan}Source:${colors.reset} ${colors.bright}${source}${colors.reset}`);
    console.log(`   ${colors.cyan}Confidence:${colors.reset} ${qualityEmoji} ${qualityColor}${bar}${colors.reset} ${colors.bright}${percentage}%${colors.reset}`);
    console.log(`   ${colors.cyan}Length:${colors.reset} ${colors.bright}${lyricsLength}${colors.reset} characters`);
  },
  
  summary: (totalAPIs: number, successCount: number, timeMs: number) => {
    if (isProduction || isVercel) {
      const successRate = totalAPIs > 0 ? (successCount / totalAPIs * 100).toFixed(0) : 0;
      log('INFO', `Search summary: ${successRate}% success (${successCount}/${totalAPIs}) in ${timeMs}ms`, {
        totalAPIs,
        successCount,
        timeMs,
        successRate,
        apiStats: Array.from(sessionStats.apiCalls.entries()).map(([name, stats]) => ({
          name,
          ...stats
        }))
      });
      return;
    }
    
    // Ensure values are valid
    const validTotal = Math.max(0, totalAPIs || 0);
    const validSuccess = Math.max(0, Math.min(successCount || 0, validTotal));
    
    const emoji = validSuccess === 0 ? '😔' : validSuccess === validTotal ? '🎉' : '✨';
    const successRate = validTotal > 0 ? (validSuccess / validTotal * 100).toFixed(0) : 0;
    
    // Create success bar
    const barLength = 30;
    const filled = validTotal > 0 ? Math.max(0, Math.floor((validSuccess / validTotal) * barLength)) : 0;
    const empty = Math.max(0, barLength - filled);
    const bar = colors.green + '█'.repeat(filled) + colors.red + '░'.repeat(empty) + colors.reset;
    
    console.log('\n' + colors.bgCyan + colors.black + ' 📊 SEARCH SUMMARY ' + colors.reset);
    console.log(colors.cyan + '═'.repeat(60) + colors.reset);
    console.log(`${emoji} Success Rate: [${bar}] ${colors.bright}${successRate}%${colors.reset} (${successCount}/${totalAPIs})`);
    console.log(`⏱️  Total Time: ${colors.bright}${timeMs}ms${colors.reset}`);
    
    // Show API statistics
    if (sessionStats.apiCalls.size > 0) {
      console.log(`\n${colors.cyan}📈 API Performance:${colors.reset}`);
      sessionStats.apiCalls.forEach((stats, apiName) => {
        const successRate = stats.count > 0 ? (stats.successes / stats.count * 100).toFixed(0) : '0';
        const statusIcon = parseInt(successRate) >= 80 ? '✅' : parseInt(successRate) >= 50 ? '⚠️' : '❌';
        console.log(
          `   ${statusIcon} ${colors.bright}${apiName.padEnd(20)}${colors.reset} ` +
          `Calls: ${colors.cyan}${stats.count}${colors.reset} | ` +
          `Success: ${colors.green}${successRate}%${colors.reset} | ` +
          `Failures: ${colors.red}${stats.failures}${colors.reset}`
        );
      });
    }
    
    // Show cache statistics
    const totalCacheOps = sessionStats.cacheHits + sessionStats.cacheMisses;
    if (totalCacheOps > 0) {
      const cacheHitRate = (sessionStats.cacheHits / totalCacheOps * 100).toFixed(0);
      console.log(`\n${colors.cyan}💾 Cache Performance:${colors.reset}`);
      console.log(
        `   Hit Rate: ${colors.green}${cacheHitRate}%${colors.reset} ` +
        `(${colors.green}${sessionStats.cacheHits} hits${colors.reset}, ${colors.yellow}${sessionStats.cacheMisses} misses${colors.reset})`
      );
    }
    
    console.log(colors.cyan + '═'.repeat(60) + colors.reset + '\n');
  },
  
  error: (context: string, error: any) => {
    const errorData = {
      context,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    if (isProduction || isVercel) {
      log('ERROR', `Error in ${context}`, errorData);
    } else {
      console.error(
        `\n${colors.bgRed}${colors.white} 🚨 ERROR ${colors.reset} ${colors.red}${colors.bright}${context}${colors.reset}`
      );
      console.log(colors.red + '─'.repeat(60) + colors.reset);
      
      if (error instanceof Error) {
        console.log(`${colors.red}Message:${colors.reset} ${colors.yellow}${error.message}${colors.reset}`);
        if (error.stack) {
          console.log(`${colors.red}Stack:${colors.reset}\n${colors.gray}${error.stack.split('\n').slice(1, 4).join('\n')}${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}Error:${colors.reset} ${colors.yellow}${JSON.stringify(error, null, 2)}${colors.reset}`);
      }
      
      console.log(colors.red + '─'.repeat(60) + colors.reset);
    }
  },
  
  info: (message: string) => {
    if (isProduction || isVercel) {
      log('INFO', message);
    } else {
      console.log(`ℹ️  ${getTimestamp()} ${colors.bgBlue}${colors.white} INFO ${colors.reset} ${colors.blue}${message}${colors.reset}`);
    }
  },
  
  debug: (message: string, data?: any) => {
    if (!DEBUG) return;
    
    if (isProduction || isVercel) {
      log('DEBUG', message, data);
    } else {
      const dataStr = data ? ` ${colors.gray}${JSON.stringify(data)}${colors.reset}` : '';
      console.log(`🔍 ${getTimestamp()} ${colors.bgCyan}${colors.black} DEBUG ${colors.reset} ${colors.cyan}${message}${colors.reset}${dataStr}`);
    }
  },
  
  success: (message: string) => {
    if (isProduction || isVercel) {
      log('INFO', `Success: ${message}`);
    } else {
      const celebration = message.includes('Found') ? ' 🎊' : '';
      console.log(
        `\n✨ ${getTimestamp()} ${colors.bgGreen}${colors.black} SUCCESS ${colors.reset} ${colors.green}${colors.bright}${message}${colors.reset}${celebration}`
      );
    }
  },
  
  warning: (message: string) => {
    if (isProduction || isVercel) {
      log('WARN', message);
    } else {
      console.log(
        `⚠️  ${getTimestamp()} ${colors.bgYellow}${colors.black} WARNING ${colors.reset} ${colors.yellow}${message}${colors.reset}`
      );
    }
  },
  
  // Language detection logging
  language: (detected: string) => {
    const flags: { [key: string]: string } = {
      'ko': '🇰🇷 Korean',
      'ja': '🇯🇵 Japanese',
      'en': '🇺🇸 English',
      'zh': '🇨🇳 Chinese',
      'unknown': '🌍 Unknown'
    };
    
    const flag = flags[detected] || flags['unknown'];
    
    if (isProduction || isVercel) {
      log('INFO', `Language detected: ${detected}`, { language: detected });
    } else {
      console.log(`🌐 ${getTimestamp()} ${colors.bgBlue}${colors.white} LANGUAGE ${colors.reset} ${colors.blue}${colors.bright}${flag}${colors.reset}`);
    }
  }
};

function getTimestamp(): string {
  if (isProduction || isVercel) {
    return new Date().toISOString();
  }
  
  const now = new Date();
  const time = now.toLocaleTimeString('ko-KR', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  });
  return `${colors.gray}[${time}]${colors.reset}`;
}

// API Response time tracker with enhanced visuals
export class APITimer {
  private startTime: number;
  private apiName: string;
  private requestId: string;
  
  constructor(apiName: string) {
    this.apiName = apiName;
    this.startTime = Date.now();
    this.requestId = generateRequestId();
    
    if (isProduction || isVercel) {
      logger.api(apiName, 'start', `Request ${this.requestId}`);
    } else {
      logger.api(apiName, 'start', '🔄 Initiating request...');
    }
  }
  
  success(details?: string): number {
    const duration = Date.now() - this.startTime;
    
    // Track timing in session stats
    const stats = sessionStats.apiCalls.get(this.apiName);
    if (stats) {
      stats.totalTime += duration;
    }
    
    if (isProduction || isVercel) {
      logger.api(this.apiName, 'success', `${details || 'Completed'} - ${duration}ms (Request ${this.requestId})`);
    } else {
      // Add performance indicator
      let perfIcon = '🚀';
      if (duration > 3000) perfIcon = '🐌';
      else if (duration > 1500) perfIcon = '🐢';
      else if (duration < 500) perfIcon = '⚡';
      
      logger.api(this.apiName, 'success', `${perfIcon} ${details || 'Completed'} (${duration}ms)`);
    }
    
    return duration;
  }
  
  fail(error?: string): number {
    const duration = Date.now() - this.startTime;
    
    if (isProduction || isVercel) {
      logger.api(this.apiName, 'fail', `${error || 'Unknown error'} - ${duration}ms (Request ${this.requestId})`);
    } else {
      logger.api(this.apiName, 'fail', `💥 ${error || 'Unknown error'} (${duration}ms)`);
    }
    
    return duration;
  }
  
  skip(reason?: string): number {
    const duration = Date.now() - this.startTime;
    
    if (isProduction || isVercel) {
      logger.api(this.apiName, 'skip', `${reason || 'Skipped'} - ${duration}ms (Request ${this.requestId})`);
    } else {
      logger.api(this.apiName, 'skip', `⏭️ ${reason || 'Skipped'} (${duration}ms)`);
    }
    
    return duration;
  }
}