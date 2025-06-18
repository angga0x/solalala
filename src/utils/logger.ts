import pino from 'pino';
import { config } from '../config/env';

const transport = config.logger.prettyPrint
  ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    }
  : {};

const logger = pino({
  level: config.logger.level,
  ...transport
});

export default logger; 