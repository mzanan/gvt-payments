/**
 * Custom hook for handling async operations with loading, error, and data states
 */

import { useState, useCallback, useEffect } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

type AsyncFn<T, Args extends unknown[]> = (...args: Args) => Promise<T>;

/**
 * Hook to handle async functions with loading, error, and result states
 * 
 * @param asyncFunction - The async function to execute
 * @param immediate - Whether to execute the function immediately
 * @param initialArgs - Initial arguments to pass to the function if immediate is true
 * @returns Object containing state and execution functions
 */
export function useAsync<T, Args extends unknown[]>(
  asyncFunction: AsyncFn<T, Args>,
  immediate = false,
  initialArgs?: Args
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  // Function to execute the async function
  const execute = useCallback(
    async (...args: Args) => {
      setState({ data: null, loading: true, error: null });
      
      try {
        const data = await asyncFunction(...args);
        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        setState({ data: null, loading: false, error: error as Error });
        throw error;
      }
    },
    [asyncFunction]
  );

  // Execute immediately if specified
  useEffect(() => {
    if (immediate && initialArgs) {
      execute(...initialArgs);
    }
  }, [execute, immediate, initialArgs]);

  // Reset the state
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Hook to periodically execute an async function with automatic cleanup
 * 
 * @param asyncFunction - The async function to execute
 * @param interval - Interval in milliseconds between executions
 * @param immediate - Whether to execute immediately on mount
 * @param args - Arguments to pass to the async function
 * @returns Object containing state and control functions
 */
export function usePolling<T, Args extends unknown[]>(
  asyncFunction: AsyncFn<T, Args>,
  interval = 5000,
  immediate = true,
  ...args: Args
) {
  const [isPolling, setIsPolling] = useState(immediate);
  const { data, loading, error, execute } = useAsync(asyncFunction, false);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Polling effect
  useEffect(() => {
    if (!isPolling) return;

    // Execute immediately
    execute(...args);

    // Set up interval
    const intervalId = setInterval(() => {
      execute(...args);
    }, interval);

    // Clean up
    return () => {
      clearInterval(intervalId);
    };
  }, [isPolling, interval, execute, args]);

  return {
    data,
    loading,
    error,
    isPolling,
    startPolling,
    stopPolling,
  };
} 