import chalk from 'chalk';

// Enhanced pretty console logger with colors, boxes, and animations
export class EnhancedLogger {
  private static instance: EnhancedLogger;
  private sessionStartTime: number;
  private apiCalls: Map<string, { count: number; totalTime: number; successes: number; failures: number }>;
  
  private constructor() {
    this.sessionStartTime = Date.now();
    this.apiCalls = new Map();
  }
  
  static getInstance(): EnhancedLogger {
    if (!EnhancedLogger.instance) {
      EnhancedLogger.instance = new EnhancedLogger();
    }
    return EnhancedLogger.instance;
  }
  
  // Session header
  startSession(taskName: string) {
    const width = 80;
    const padding = Math.max(0, Math.floor((width - taskName.length - 2) / 2));
    
    console.log('\n' + chalk.cyan('═'.repeat(width)));
    console.log(chalk.cyan('║') + ' '.repeat(padding) + chalk.bold.white(taskName) + ' '.repeat(width - padding - taskName.length - 2) + chalk.cyan('║'));
    console.log(chalk.cyan('╠' + '═'.repeat(width - 2) + '╣'));
    console.log(chalk.cyan('║') + chalk.gray(` Started: ${new Date().toLocaleString('ko-KR')}`.padEnd(width - 2)) + chalk.cyan('║'));
    console.log(chalk.cyan('╚' + '═'.repeat(width - 2) + '╝'));
  }
  
  // Search operation with animation
  search(query: string, type: 'artist-title' | 'combined' | 'query' = 'query') {
    const typeEmoji = {
      'artist-title': '🎤🎵',
      'combined': '🔀',
      'query': '🔍'
    };
    
    console.log('\n' + chalk.bgMagenta.white.bold(' SEARCH ') + ' ' + typeEmoji[type] + ' ' + chalk.magenta(query));
    console.log(chalk.gray('─'.repeat(60)));
  }
  
  // API call with visual progress
  apiCall(apiName: string, status: 'start' | 'success' | 'fail' | 'skip', details?: string, data?: any) {
    const statusConfig = {
      start: {
        icon: '🚀',
        color: chalk.cyan,
        bgColor: chalk.bgCyan.black,
        text: 'CALLING'
      },
      success: {
        icon: '✅',
        color: chalk.green,
        bgColor: chalk.bgGreen.black,
        text: 'SUCCESS'
      },
      fail: {
        icon: '❌',
        color: chalk.red,
        bgColor: chalk.bgRed.white,
        text: 'FAILED '
      },
      skip: {
        icon: '⏭️',
        color: chalk.yellow,
        bgColor: chalk.bgYellow.black,
        text: 'SKIPPED'
      }
    };
    
    const config = statusConfig[status];
    const timestamp = this.getTimestamp();
    
    // Update API stats
    if (!this.apiCalls.has(apiName)) {
      this.apiCalls.set(apiName, { count: 0, totalTime: 0, successes: 0, failures: 0 });
    }
    const stats = this.apiCalls.get(apiName)!;
    stats.count++;
    if (status === 'success') stats.successes++;
    if (status === 'fail') stats.failures++;
    
    // Pretty output
    const apiLabel = config.bgColor(` ${config.text} `);
    const apiNameFormatted = chalk.bold(apiName.padEnd(20));
    
    console.log(
      `${config.icon} ${timestamp} ${apiLabel} ${apiNameFormatted} ${config.color(details || '')}`
    );
    
    // Additional data if provided
    if (data) {
      if (data.confidence !== undefined) {
        this.confidenceBar(data.confidence);
      }
      if (data.lyricsLength !== undefined) {
        console.log(`   ${chalk.gray('└─')} ${chalk.cyan('📝')} Length: ${chalk.bold(data.lyricsLength)} chars`);
      }
      if (data.hasLRC) {
        console.log(`   ${chalk.gray('└─')} ${chalk.green('🎵')} ${chalk.bold.green('LRC Timestamps Available!')}`);
      }
    }
  }
  
  // Cache status with visual indicator
  cache(hit: boolean, key: string, details?: string) {
    const icon = hit ? '💎' : '🔄';
    const status = hit ? chalk.bgGreen.black(' CACHE HIT ') : chalk.bgYellow.black(' CACHE MISS ');
    const color = hit ? chalk.green : chalk.yellow;
    
    console.log(
      `\n${icon} ${this.getTimestamp()} ${status} ${color(key)} ${chalk.gray(details || '')}`
    );
  }
  
  // Database operation with icons
  database(operation: 'save' | 'update' | 'fetch' | 'delete' | 'query', table: string, details?: string) {
    const ops = {
      save: { icon: '💾', color: chalk.green, bg: chalk.bgGreen.black },
      update: { icon: '📝', color: chalk.blue, bg: chalk.bgBlue.black },
      fetch: { icon: '📚', color: chalk.cyan, bg: chalk.bgCyan.black },
      delete: { icon: '🗑️', color: chalk.red, bg: chalk.bgRed.white },
      query: { icon: '🔍', color: chalk.magenta, bg: chalk.bgMagenta.white }
    };
    
    const op = ops[operation];
    console.log(
      `${op.icon} ${this.getTimestamp()} ${op.bg(` DB:${operation.toUpperCase()} `)} ${op.color(table)} ${chalk.gray(details || '')}`
    );
  }
  
  // Language detection with flags
  language(detected: string, confidence?: number) {
    const flags: { [key: string]: string } = {
      'ko': '🇰🇷 Korean',
      'ja': '🇯🇵 Japanese',
      'en': '🇺🇸 English',
      'zh': '🇨🇳 Chinese',
      'es': '🇪🇸 Spanish',
      'fr': '🇫🇷 French',
      'unknown': '🌍 Unknown'
    };
    
    const flag = flags[detected] || flags['unknown'];
    const confText = confidence ? ` (${(confidence * 100).toFixed(0)}% confident)` : '';
    
    console.log(
      `\n🌐 ${this.getTimestamp()} ${chalk.bgBlue.white(' LANGUAGE ')} ${chalk.bold.blue(flag)}${chalk.gray(confText)}`
    );
  }
  
  // Progress bar for operations
  progress(current: number, total: number, label: string) {
    const percentage = Math.floor((current / total) * 100);
    const barLength = 40;
    const filled = Math.floor((current / total) * barLength);
    const empty = barLength - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percentText = chalk.bold(`${percentage}%`);
    
    process.stdout.write(
      `\r📊 ${label}: [${bar}] ${percentText} (${current}/${total})`
    );
    
    if (current === total) {
      console.log(' ✅');
    }
  }
  
  // Confidence visualization
  private confidenceBar(confidence: number) {
    const percentage = Math.floor(confidence * 100);
    const stars = Math.floor(confidence * 5);
    
    let color = chalk.red;
    let emoji = '😟';
    
    if (confidence >= 0.9) {
      color = chalk.green;
      emoji = '🌟';
    } else if (confidence >= 0.7) {
      color = chalk.yellow;
      emoji = '⭐';
    } else if (confidence >= 0.5) {
      color = chalk.cyan;
      emoji = '💫';
    }
    
    const bar = '█'.repeat(Math.floor(confidence * 10)).padEnd(10, '░');
    console.log(
      `   ${chalk.gray('└─')} ${emoji} Confidence: ${color(bar)} ${color.bold(`${percentage}%`)}`
    );
  }
  
  // Result summary with statistics
  result(results: any[], bestResult: any) {
    console.log('\n' + chalk.bgGreen.black.bold(' 🎯 SEARCH RESULTS '));
    console.log(chalk.green('═'.repeat(60)));
    
    // Best result
    if (bestResult) {
      console.log(chalk.green.bold('🏆 Best Match:'));
      console.log(`   ${chalk.cyan('Source:')} ${chalk.bold(bestResult.source)}`);
      console.log(`   ${chalk.cyan('Artist:')} ${bestResult.artist}`);
      console.log(`   ${chalk.cyan('Title:')} ${bestResult.title}`);
      if (bestResult.confidence) {
        this.confidenceBar(bestResult.confidence);
      }
      if (bestResult.syncedLyrics) {
        console.log(`   ${chalk.green.bold('✨ LRC Timestamps Available!')}`);
      }
    }
    
    // Other results
    if (results.length > 1) {
      console.log(chalk.gray('\n📋 Alternative Results:'));
      results.slice(1, 4).forEach((result, index) => {
        const conf = result.confidence ? ` (${(result.confidence * 100).toFixed(0)}%)` : '';
        const lrc = result.syncedLyrics ? ' 🎵' : '';
        console.log(chalk.gray(`   ${index + 2}. ${result.source}${conf}${lrc}`));
      });
    }
    
    console.log(chalk.green('═'.repeat(60)));
  }
  
  // Session summary
  endSession(successCount: number, totalCount: number, timeMs: number) {
    const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(0) : 0;
    const emoji = successCount === 0 ? '😔' : successCount === totalCount ? '🎉' : '✨';
    
    console.log('\n' + chalk.bgCyan.black.bold(' 📊 SESSION SUMMARY '));
    console.log(chalk.cyan('═'.repeat(60)));
    
    // Success rate with visual bar
    const barLength = 30;
    const filled = Math.floor((successCount / totalCount) * barLength);
    const empty = barLength - filled;
    const bar = chalk.green('█'.repeat(filled)) + chalk.red('░'.repeat(empty));
    
    console.log(`${emoji} Success Rate: [${bar}] ${chalk.bold(`${successRate}%`)} (${successCount}/${totalCount})`);
    console.log(`⏱️  Total Time: ${chalk.bold(`${timeMs}ms`)}`);
    
    // API call statistics
    if (this.apiCalls.size > 0) {
      console.log(chalk.cyan('\n📈 API Statistics:'));
      this.apiCalls.forEach((stats, apiName) => {
        const avgTime = stats.totalTime / stats.count;
        const successRate = stats.count > 0 ? (stats.successes / stats.count * 100).toFixed(0) : 0;
        console.log(
          `   ${chalk.bold(apiName.padEnd(20))} ` +
          `Calls: ${chalk.cyan(stats.count)} | ` +
          `Success: ${chalk.green(successRate + '%')} | ` +
          `Avg: ${chalk.yellow(avgTime.toFixed(0) + 'ms')}`
        );
      });
    }
    
    console.log(chalk.cyan('═'.repeat(60)) + '\n');
  }
  
  // Error with stack trace
  error(context: string, error: any, showStack: boolean = false) {
    console.log('\n' + chalk.bgRed.white.bold(' 🚨 ERROR ') + ' ' + chalk.red.bold(context));
    console.log(chalk.red('─'.repeat(60)));
    
    if (error instanceof Error) {
      console.log(chalk.red('Message: ') + chalk.yellow(error.message));
      if (showStack && error.stack) {
        console.log(chalk.red('Stack Trace:'));
        console.log(chalk.gray(error.stack));
      }
    } else {
      console.log(chalk.red('Error: ') + chalk.yellow(JSON.stringify(error, null, 2)));
    }
    
    console.log(chalk.red('─'.repeat(60)));
  }
  
  // Info message with icon
  info(message: string, icon: string = 'ℹ️') {
    console.log(`${icon}  ${this.getTimestamp()} ${chalk.bgBlue.white(' INFO ')} ${chalk.blue(message)}`);
  }
  
  // Success message with celebration
  success(message: string, celebrate: boolean = false) {
    const celebration = celebrate ? ' 🎊🎉🎊' : '';
    console.log(
      `\n✨ ${this.getTimestamp()} ${chalk.bgGreen.black.bold(' SUCCESS ')} ${chalk.green.bold(message)}${celebration}`
    );
  }
  
  // Warning message
  warning(message: string) {
    console.log(
      `⚠️  ${this.getTimestamp()} ${chalk.bgYellow.black(' WARNING ')} ${chalk.yellow(message)}`
    );
  }
  
  // Custom divider
  divider(char: string = '─', length: number = 60, color: any = chalk.gray) {
    console.log(color(char.repeat(length)));
  }
  
  // Get formatted timestamp
  private getTimestamp(): string {
    const now = new Date();
    const time = now.toLocaleTimeString('ko-KR', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    return chalk.gray(`[${time}]`);
  }
  
  // Table display for data
  table(headers: string[], rows: any[][], title?: string) {
    if (title) {
      console.log('\n' + chalk.bgCyan.black.bold(` ${title} `));
    }
    
    // Calculate column widths
    const widths = headers.map((h, i) => {
      const maxRow = Math.max(...rows.map(r => String(r[i] || '').length));
      return Math.max(h.length, maxRow) + 2;
    });
    
    // Header
    console.log(chalk.cyan('┌' + widths.map(w => '─'.repeat(w)).join('┬') + '┐'));
    console.log(chalk.cyan('│') + headers.map((h, i) => chalk.bold(h.padEnd(widths[i]))).join(chalk.cyan('│')) + chalk.cyan('│'));
    console.log(chalk.cyan('├' + widths.map(w => '─'.repeat(w)).join('┼') + '┤'));
    
    // Rows
    rows.forEach(row => {
      console.log(chalk.cyan('│') + row.map((cell, i) => String(cell || '').padEnd(widths[i])).join(chalk.cyan('│')) + chalk.cyan('│'));
    });
    
    // Footer
    console.log(chalk.cyan('└' + widths.map(w => '─'.repeat(w)).join('┴') + '┘'));
  }
}

// Enhanced API Timer with visual feedback
export class EnhancedAPITimer {
  private startTime: number;
  private apiName: string;
  private logger: EnhancedLogger;
  
  constructor(apiName: string) {
    this.apiName = apiName;
    this.startTime = Date.now();
    this.logger = EnhancedLogger.getInstance();
    this.logger.apiCall(apiName, 'start', 'Initiating request...');
  }
  
  success(details?: string, data?: any): number {
    const duration = Date.now() - this.startTime;
    this.logger.apiCall(this.apiName, 'success', `${details || 'Completed'} (${duration}ms)`, data);
    return duration;
  }
  
  fail(error?: string): number {
    const duration = Date.now() - this.startTime;
    this.logger.apiCall(this.apiName, 'fail', `${error || 'Unknown error'} (${duration}ms)`);
    return duration;
  }
  
  skip(reason?: string): number {
    const duration = Date.now() - this.startTime;
    this.logger.apiCall(this.apiName, 'skip', `${reason || 'Skipped'} (${duration}ms)`);
    return duration;
  }
}

// Export singleton instance
export const enhancedLogger = EnhancedLogger.getInstance();