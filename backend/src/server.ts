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
    const { billingRoutes } = await import('./routes/billing');
    const { adminRoutes, resetAllWalletBalances, promoteSuperAdmin } = await import('./routes/admin');

    // Register routes
    await app.register(voiceRoutes,   { prefix: '/api/v1/voice' });
    await app.register(smsRoutes,     { prefix: '/api/v1/sms' });
    await app.register(agentRoutes,   { prefix: '/api/v1/agents' });
    await app.register(authRoutes,    { prefix: '/api/v1/auth' });
    await app.register(phoneRoutes,   { prefix: '/api/v1/phone' });
    await app.register(billingRoutes, { prefix: '/api/v1/billing' });
    await app.register(adminRoutes,   { prefix: '/api/v1/admin' });

    // Execute background admin tasks: ensure super admin role configured
    setTimeout(async () => {
      try {
        await promoteSuperAdmin('sammyseth260');
      } catch (adminInitErr: any) {
        logger.warn({ err: adminInitErr?.message }, 'Startup admin initialization note');
      }
    }, 1000);

    const listenPort = Number(process.env.PORT) || config.port || 5050;

    // Start listening
    await app.listen({
      port: listenPort,
      host: '0.0.0.0', // Listen on all interfaces (required for Docker/Render)
    });

    logger.info(
      {
        port: listenPort,
        env: config.nodeEnv,
        baseUrl: config.baseUrl,
      },
      '✓ CallPulse Backend Server started successfully'
    );

    logger.info(`Server listening on http://0.0.0.0:${listenPort}`);
    logger.info(`Health check: http://0.0.0.0:${listenPort}/api/v1/health`);

    // Log configuration (non-sensitive)
    logger.info(
      {
        groqModel: config.groqModel,
        logLevel: config.logLevel,
        cacheOrgTtl: config.cacheOrgTtl,
      },
      'Server configuration loaded'
    );
  } catch (error: any) {
    logger.error({ err: error, message: error?.message, stack: error?.stack }, `✗ Failed to start server: ${error?.message || error}`);
    console.error('SERVER START ERROR:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: any) => {
  logger.fatal({ err: error, message: error?.message, stack: error?.stack }, `Uncaught exception: ${error?.message || error}`);
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise) => {
  logger.fatal({ reason, message: reason?.message, stack: reason?.stack }, `Unhandled promise rejection: ${reason?.message || reason}`);
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

// Start the server
start();
