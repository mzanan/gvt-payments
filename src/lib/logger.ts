/**
 * Optimized logging utility with reduced verbosity for development
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LoggerOptions {
  minLevel: LogLevel;
  enableConsole: boolean;
  productionMode: boolean;
  enabledFlows?: string[];  // Optional whitelist of flows to log
}

// Define la estructura de los datos de log
interface LogData {
  flow?: string;
  operation?: string;
  stage?: string;
  error?: unknown;
  orderId?: string;
  status?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

class Logger {
  private options: LoggerOptions;
  
  constructor(options?: Partial<LoggerOptions>) {
    // By default, use more restrictive logging in development
    const isDev = process.env.NODE_ENV !== 'production';
    
    this.options = {
      // In development, default to info level to reduce noise
      minLevel: options?.minLevel || (isDev ? 'info' : 'info'),
      enableConsole: options?.enableConsole ?? true,
      productionMode: options?.productionMode ?? (process.env.NODE_ENV === 'production'),
      // Only log specific flows that are important
      enabledFlows: options?.enabledFlows || [
        'api_auth',      // Authentication
        'security',      // Security warnings
        'error',         // Errors
        'payment_status' // Payment status updates
      ]
    };
  }

  private shouldLog(level: LogLevel, data?: unknown): boolean {
    // Check log level first
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.minLevel]) {
      return false;
    }
    
    // If not in development or it's an error/fatal log, always show it
    if (level === 'error' || level === 'fatal' || !this.options.productionMode) {
      return true;
    }
    
    // Filter based on flow if configured and flow is present in data
    if (this.options.enabledFlows && this.options.enabledFlows.length > 0 && 
        typeof data === 'object' && data !== null && 'flow' in data) {
      const logData = data as LogData;
      return this.options.enabledFlows.includes(logData.flow || '');
    }
    
    return true;
  }

  private formatLog(level: LogLevel, data: unknown, message?: string): Record<string, unknown> {
    const timestamp = new Date().toISOString();
    
    // In production, create structured logs
    if (this.options.productionMode) {
      if (typeof data === 'object' && data !== null) {
        return {
          level,
          timestamp,
          message: message || '',
          ...(data as Record<string, unknown>),
        };
      }
      return {
        level,
        timestamp,
        message: message || '',
        data
      };
    } 
    
    // In development, simplify logs for readability
    if (typeof data === 'object' && data !== null && Object.keys(data as object).length > 0) {
      const logData = data as LogData;
      return {
        level,
        message: message || '',
        // Only include essential fields to reduce noise
        flow: logData.flow,
        operation: logData.operation,
        stage: logData.stage,
        error: logData.error,
        // Include other fields only if they're explicitly important
        ...(logData.orderId ? { orderId: logData.orderId } : {}),
        ...(logData.status ? { status: logData.status } : {})
      };
    }
    
    return {
      level,
      message: message || '',
      data
    };
  }

  private log(level: LogLevel, data: unknown, message?: string): void {
    if (!this.shouldLog(level, data)) return;
    
    const formattedLog = this.formatLog(level, data, message);
    
    if (this.options.enableConsole) {
      if (this.options.productionMode) {
        // In production, log as JSON strings for better parsing by log aggregators
        console[level === 'fatal' ? 'error' : level](JSON.stringify(formattedLog));
      } else {
        // In development, use console methods directly for better readability
        const consoleMethod = level === 'fatal' ? 'error' : level === 'trace' ? 'debug' : level;
        
        // For debug/trace logs, use a simpler format
        if (level === 'debug' || level === 'trace') {
          let flowInfo = '';
          if (typeof data === 'object' && data !== null && 'flow' in data) {
            const logData = data as LogData;
            flowInfo = logData.flow ? 
              `(${logData.flow}${logData.operation ? '/' + logData.operation : ''})` : '';
          }
          console[consoleMethod](`[${level.toUpperCase()}] ${message || ''}`, flowInfo);
        } else {
          // For info and above, include more details
          console[consoleMethod](message || '', formattedLog);
        }
      }
    }
  }

  trace(data: unknown, message?: string): void {
    this.log('trace', data, message);
  }

  debug(data: unknown, message?: string): void {
    this.log('debug', data, message);
  }

  info(data: unknown, message?: string): void {
    this.log('info', data, message);
  }

  warn(data: unknown, message?: string): void {
    this.log('warn', data, message);
  }

  error(data: unknown, message?: string): void {
    this.log('error', data, message);
  }

  fatal(data: unknown, message?: string): void {
    this.log('fatal', data, message);
  }
}

// Create the singleton logger instance
export const logger = new Logger();

// Export a function to configure logger at application start
export function configureLogger(options: Partial<LoggerOptions>): void {
  Object.assign(logger, new Logger(options));
}

// Convenience function to set minimum log level
export function setLogLevel(level: LogLevel): void {
  configureLogger({ minLevel: level });
}

// Convenience function to enable specific flows
export function enableFlows(flows: string[]): void {
  configureLogger({ enabledFlows: flows });
}
