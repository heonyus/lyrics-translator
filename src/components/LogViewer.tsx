'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Trash2, 
  Download, 
  Pause, 
  Play,
  Filter,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  Zap
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning' | 'api' | 'cache' | 'db' | 'search';
  message: string;
  details?: any;
  duration?: number;
}

interface LogViewerProps {
  className?: string;
  maxEntries?: number;
  autoScroll?: boolean;
}

export default function LogViewer({ 
  className = '', 
  maxEntries = 100,
  autoScroll = true 
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({
    totalAPICalls: 0,
    successRate: 0,
    avgResponseTime: 0,
    cacheHitRate: 0
  });
  
  // Intercept console.log to capture logs
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Override console methods
    console.log = (...args) => {
      originalLog.apply(console, args);
      if (!isPaused) {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLog('info', message);
      }
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      if (!isPaused) {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLog('error', message);
      }
    };
    
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      if (!isPaused) {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        addLog('warning', message);
      }
    };
    
    // Cleanup
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [isPaused]);
  
  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (autoScroll && !isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isPaused]);
  
  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    const newEntry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type: detectLogType(message, type),
      message: cleanMessage(message),
      details,
      duration: extractDuration(message)
    };
    
    setLogs(prev => {
      const updated = [...prev, newEntry];
      // Keep only last maxEntries
      if (updated.length > maxEntries) {
        return updated.slice(-maxEntries);
      }
      return updated;
    });
    
    // Update stats
    updateStats(newEntry);
  };
  
  const detectLogType = (message: string, defaultType: LogEntry['type']): LogEntry['type'] => {
    if (message.includes('API') || message.includes('CALLING') || message.includes('SUCCESS')) return 'api';
    if (message.includes('CACHE')) return 'cache';
    if (message.includes('DB:')) return 'db';
    if (message.includes('SEARCH')) return 'search';
    if (message.includes('ERROR') || message.includes('🚨')) return 'error';
    if (message.includes('SUCCESS') || message.includes('✅')) return 'success';
    if (message.includes('WARNING') || message.includes('⚠️')) return 'warning';
    return defaultType;
  };
  
  const cleanMessage = (message: string): string => {
    // Remove ANSI color codes
    return message.replace(/\x1b\[[0-9;]*m/g, '');
  };
  
  const extractDuration = (message: string): number | undefined => {
    const match = message.match(/\((\d+)ms\)/);
    return match ? parseInt(match[1]) : undefined;
  };
  
  const updateStats = (entry: LogEntry) => {
    setStats(prev => {
      const newStats = { ...prev };
      
      if (entry.type === 'api') {
        newStats.totalAPICalls++;
        if (entry.message.includes('SUCCESS')) {
          const currentSuccess = Math.floor((prev.successRate * prev.totalAPICalls) / 100);
          newStats.successRate = Math.floor(((currentSuccess + 1) / newStats.totalAPICalls) * 100);
        }
        if (entry.duration) {
          const totalTime = prev.avgResponseTime * prev.totalAPICalls;
          newStats.avgResponseTime = Math.floor((totalTime + entry.duration) / newStats.totalAPICalls);
        }
      }
      
      if (entry.type === 'cache') {
        if (entry.message.includes('HIT')) {
          newStats.cacheHitRate = Math.min(100, newStats.cacheHitRate + 5);
        }
      }
      
      return newStats;
    });
  };
  
  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'api': return <Zap className="w-4 h-4" />;
      case 'cache': return <Database className="w-4 h-4" />;
      case 'db': return <Database className="w-4 h-4" />;
      case 'search': return <Search className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'success': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      default: return <Terminal className="w-4 h-4" />;
    }
  };
  
  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'api': return 'text-cyan-400';
      case 'cache': return 'text-green-400';
      case 'db': return 'text-blue-400';
      case 'search': return 'text-magenta-400';
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };
  
  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.type !== filter) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  
  const clearLogs = () => {
    setLogs([]);
    setStats({
      totalAPICalls: 0,
      successRate: 0,
      avgResponseTime: 0,
      cacheHitRate: 0
    });
  };
  
  const exportLogs = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Terminal className="w-5 h-5" />
            System Logs
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Stats badges */}
            <Badge variant="outline" className="text-xs">
              API: {stats.totalAPICalls}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Success: {stats.successRate}%
            </Badge>
            <Badge variant="outline" className="text-xs">
              Avg: {stats.avgResponseTime}ms
            </Badge>
            <Badge variant="outline" className="text-xs">
              Cache: {stats.cacheHitRate}%
            </Badge>
            
            {/* Controls */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsPaused(!isPaused)}
              className="text-gray-400 hover:text-white"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={exportLogs}
              className="text-gray-400 hover:text-white"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearLogs}
              className="text-gray-400 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 mt-4">
          <div className="flex gap-1">
            {['all', 'api', 'cache', 'db', 'search', 'error'].map(type => (
              <Button
                key={type}
                size="sm"
                variant={filter === type ? 'default' : 'ghost'}
                onClick={() => setFilter(type)}
                className="text-xs"
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
          
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-300 focus:outline-none focus:border-gray-600"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea 
          className="h-96 w-full" 
          ref={scrollRef}
        >
          <div className="p-4 font-mono text-xs space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No logs to display
              </div>
            ) : (
              filteredLogs.map(log => (
                <div 
                  key={log.id} 
                  className="flex items-start gap-2 hover:bg-gray-800/50 px-2 py-1 rounded"
                >
                  <span className="text-gray-600 text-xs min-w-[60px]">
                    {log.timestamp.toLocaleTimeString('ko-KR', { 
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                  
                  <span className={getTypeColor(log.type)}>
                    {getTypeIcon(log.type)}
                  </span>
                  
                  <span className="flex-1 text-gray-300 break-all">
                    {log.message}
                    {log.duration && (
                      <span className="text-gray-500 ml-2">
                        ({log.duration}ms)
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}