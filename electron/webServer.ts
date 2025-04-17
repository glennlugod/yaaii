import { CallGraphParams, CallGraphResult } from './AIGraph/sendMessage.js';
import { dirname, join } from 'path';
import express, { Request, Response } from 'express';

import { WorkerPool } from './workerPool.js';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const expressApp = express();
const PORT = 1941;

// CORS configuration to allow requests from localhost:5173 (vite server for debugging)
const corsOrigins = process.env.NODE_ENV === 'development' ? ['http://localhost:5173'] : [];
const corsOptions = {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
expressApp.use(cors(corsOptions));

// Create a worker pool
const workerPool = new WorkerPool();

const frontendPath = join(__dirname, "frontend");
expressApp.use(express.static(frontendPath));
expressApp.use(express.json());

expressApp.post('/api/sendMessage', async (req: Request, res: Response) => {
  try {
    const params: CallGraphParams = req.body;
    
    const worker = workerPool.getWorker();
    if (!worker) {
      res.status(503).json({
        success: false,
        error: 'No available workers'
      });
      return;
    }

    try {
      const result = await new Promise<CallGraphResult>((resolve, reject) => {
        const messageHandler = (result: CallGraphResult) => {
          // Remove the listener to prevent memory leaks
          worker.removeListener('message', messageHandler);

          // Release the worker back to the pool
          workerPool.releaseWorker(worker);

          resolve(result);
        };

        const errorHandler = (error: Error) => {
          // Remove listeners
          worker.removeListener('message', messageHandler);
          worker.removeListener('error', errorHandler);

          // Release the worker back to the pool
          workerPool.releaseWorker(worker);

          reject(error);
        };

        worker.on('message', messageHandler);
        worker.on('error', errorHandler);

        const defaultSystemMessage = "You are a helpful assistant with access to tools. " +
          "Do not default to call any tool. " +
          "When a user message is sent, first check if a call to a tool is necessary. " +
          "Only use a tool when the user's query requires it. " +
          "If not, just answer the user's query. " +
          "Always provide your answer in a markdown format.";

        // Use provided system messag or default
        const systemMessage = params.systemMessage ?? defaultSystemMessage;

        // Modify params to include default system message if not provided
        const callGraphParams: CallGraphParams = {
          ...params, 
          systemMessage: systemMessage
        };

        // Set worker data to trigger task
        worker.postMessage(callGraphParams);
      });

      // Respond with the result in the same format as the IPC handler
      if (result.success) {
        res.json({
          success: true,
          threadId: result.threadId,
          response: result.response?.content
        });
      } else {
        res.status(500).json({
          success: false,
          threadId: result.threadId,
          error: result.error
        });
      }
    } catch (workerError) {
      res.status(500).json({
        success: false,
        error: workerError instanceof Error ? workerError.message : 'Unknown worker error'
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const server = expressApp.listen(PORT, () => {
  console.info(`Server running at http://localhost:${PORT}`);
});

// Handle server errors
server.on('error', (err: Error) => {
  console.error('Express server error:', err);
  workerPool.terminateAll(); // Terminate workers on server error
  process.exit(1); // Exit with an error code
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.info('Received SIGINT. Shutting down gracefully...');
  workerPool.terminateAll(); // Terminate workers on process interrupt
  server.close(() => {
    console.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  workerPool.terminateAll(); // Terminate workers on uncaught exception
  process.exit(1);
});

export { expressApp };
