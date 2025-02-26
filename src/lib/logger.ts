/* eslint-disable @typescript-eslint/no-explicit-any */

export const logger = {
  info: (data: any, msg?: string) => {
    console.log(`[INFO] ${msg || ''}`, data);
  },
  error: (data: any, msg?: string) => {
    console.error(`[ERROR] ${msg || ''}`, data);
  },
  warn: (data: any, msg?: string) => {
    console.warn(`[WARN] ${msg || ''}`, data);
  },
  debug: (data: any, msg?: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${msg || ''}`, data);
    }
  }
};
