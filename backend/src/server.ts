// ==============================================
// CallPulse Backend Server Entry Point
// ==============================================

import { app } from './app';
import { config } from './lib/config';
import { logger } from './lib/logger';

// ==============================================
// Start Server
// ==============================================

async function start() {
  try {
    // Import and register route handlers
    const { voiceRoutes } = await import('./routes/voice');
    const { smsRoutes } = await import('./routes/sms');
    const { agentRoutes } = await import('./routes/agents');
    const { authRoutes } = await import('./routes/auth');
    const { phoneRoutes } = await import('./routes/phone');

    // Register routes
    await app.register(voiceRoutes, { prefix: '/api/v1/voice' });
    await app.register(smsRoutes,   { prefix: '/api/v1/sms' });
    await app.register(agentRoutes, { prefix: '/api/v1/agents' });
    await app.register(authRoutes,  { prefix: '/api/v1/auth' });
    await app.register(phoneRoutes, { prefix: '/api/v1/phone' });

    // Start listening
    await app.listen({
      port: config.port,
      host: '0.0.0.0', // Listen on all interfaces (required for Docker/Render)
    });

    logger.info(
      {
        port: config.port,
        env: config.nodeEnv,
        baseUrl: config.baseUrl,
      },
      '✓ CallPulse Backend Server started successfully'
    );

    logger.info(`Server listening on http://0.0.0.0:${config.port}`);
    logger.info(`Health check: http://0.0.0.0:${config.port}/api/v1/health`);

    // Log configuration (non-sensitive)
    logger.info(
      {
        groqModel: config.groqModel,
        logLevel: config.logLevel,
        cacheOrgTtl: config.cacheOrgTtl,
      },
      'Server configuration loaded'
    );
  } catch (error) {
    logger.error({ error }, '✗ Failed to start server');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

// Start the server
start();
