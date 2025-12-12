import pino from 'pino';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default pino({
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: `${__dirname}/logs/${Math.round(new Date().getTime() / 1000)}.log.jsonl`, mkdir: true },
      },
      ...(process.env.JUMPSTART_DEBUG == 'true'
        ? [
            {
              target: 'pino/file',
            },
          ]
        : []),
    ],
  },
});
