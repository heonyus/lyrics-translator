// Pretty console logger with colors and emojis
export const logger = {
  search: (message: string) => {
    console.log(`\n🔍 ${getTimestamp()} [SEARCH] ${message}`);
  },
  
  api: (apiName: string, status: 'start' | 'success' | 'fail' | 'skip', details?: string) => {
    const icons = {
      start: '🚀',
      success: '✅',
      fail: '❌',
      skip: '⏭️'
    };
    
    const colors = {
      start: '\x1b[36m',    // Cyan
      success: '\x1b[32m',  // Green
      fail: '\x1b[31m',     // Red
      skip: '\x1b[33m',     // Yellow
      reset: '\x1b[0m'
    };
    
    const icon = icons[status];
    const color = colors[status];
    const statusText = status.toUpperCase().padEnd(7);
    
    console.log(
      `${color}${icon} ${getTimestamp()} [${statusText}] ${apiName.padEnd(15)} ${details || ''}${colors.reset}`
    );
  },
  
  cache: (hit: boolean, details: string) => {
    if (hit) {
      console.log(`\n💾 ${getTimestamp()} [CACHE HIT] ${details}`);
    } else {
      console.log(`\n🔄 ${getTimestamp()} [CACHE MISS] ${details}`);
    }
  },
  
  db: (operation: 'save' | 'update' | 'fetch' | 'delete', details: string) => {
    const icons = {
      save: '💾',
      update: '📝',
      fetch: '📚',
      delete: '🗑️'
    };
    console.log(`${icons[operation]} ${getTimestamp()} [DB ${operation.toUpperCase()}] ${details}`);
  },
  
  result: (source: string, confidence: number, lyricsLength: number) => {
    const qualityEmoji = confidence > 0.8 ? '🌟' : confidence > 0.6 ? '⭐' : '💫';
    console.log(
      `\n${qualityEmoji} ${getTimestamp()} [RESULT] Source: ${source} | Confidence: ${(confidence * 100).toFixed(0)}% | Length: ${lyricsLength} chars`
    );
  },
  
  summary: (totalAPIs: number, successCount: number, timeMs: number) => {
    const emoji = successCount === 0 ? '😔' : successCount === totalAPIs ? '🎉' : '✨';
    console.log(
      `\n${emoji} ${getTimestamp()} [SUMMARY] ${successCount}/${totalAPIs} APIs succeeded | Time: ${timeMs}ms`
    );
    console.log('━'.repeat(80) + '\n');
  },
  
  error: (context: string, error: any) => {
    console.error(
      `\n🚨 ${getTimestamp()} [ERROR] ${context}`,
      error instanceof Error ? error.message : error
    );
  },
  
  info: (message: string) => {
    console.log(`ℹ️  ${getTimestamp()} [INFO] ${message}`);
  },
  
  success: (message: string) => {
    console.log(`\n✨ ${getTimestamp()} [SUCCESS] ${message}`);
  }
};

function getTimestamp(): string {
  const now = new Date();
  const time = now.toLocaleTimeString('ko-KR', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  return `\x1b[90m${time}\x1b[0m`; // Gray color for timestamp
}

// API Response time tracker
export class APITimer {
  private startTime: number;
  private apiName: string;
  
  constructor(apiName: string) {
    this.apiName = apiName;
    this.startTime = Date.now();
    logger.api(apiName, 'start', 'Fetching lyrics...');
  }
  
  success(details?: string): number {
    const duration = Date.now() - this.startTime;
    logger.api(this.apiName, 'success', `${details || ''} (${duration}ms)`);
    return duration;
  }
  
  fail(error?: string): number {
    const duration = Date.now() - this.startTime;
    logger.api(this.apiName, 'fail', `${error || 'Unknown error'} (${duration}ms)`);
    return duration;
  }
  
  skip(reason?: string): number {
    const duration = Date.now() - this.startTime;
    logger.api(this.apiName, 'skip', reason || 'Skipped');
    return duration;
  }
}