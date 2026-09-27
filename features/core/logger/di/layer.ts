import { ConsoleLogger } from '@timothyrusso/effect-core';

/**
 * The `Logger` the runtime provides: the console, in every build, as the app logged before the
 * kit. A crash reporter's Layer replaces it here when the app gets one.
 */
export const LoggerLive = ConsoleLogger;
