import { AsyncLocalStorage } from 'async_hooks';
import { Logger } from './logger';

interface LoggerContext {
  logger: Logger;
}

const asyncLocalStorage = new AsyncLocalStorage<LoggerContext>();

export function RunWithLogger<T>(logger: Logger, fn: () => T): T {
  return asyncLocalStorage.run({ logger }, fn);
}

export function GetLogger(): Logger | undefined {
  const context = asyncLocalStorage.getStore();
  return context?.logger;
}

