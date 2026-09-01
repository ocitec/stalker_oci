import { EventEmitter } from 'events';

// Raise the global EventEmitter listener limit BEFORE ioredis / BullMQ / Prisma
// initialise. Those libraries each attach several listeners to shared emitters,
// which trips Node's default limit of 10 and prints a (harmless)
// MaxListenersExceededWarning. This is a preload module imported first from
// main.ts so the limit is raised before any other module loads.
EventEmitter.defaultMaxListeners = 30;
