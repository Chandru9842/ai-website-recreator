import { createApp } from './app';
import { Logger } from './utils/logger';

const logger = new Logger('ServerEntry');
const PORT = process.env.PORT || 5000;

const app = createApp();

app.listen(PORT, () => {
  logger.info(`=================================================`);
  logger.info(`🚀 AI Website Recreator Server is running!`);
  logger.info(`📡 Port: http://localhost:${PORT}`);
  logger.info(`🩺 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`🔍 Analyze endpoint: POST http://localhost:${PORT}/api/analyze`);
  logger.info(`=================================================`);
});
