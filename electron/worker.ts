import { isMainThread, parentPort } from 'worker_threads';

import { CallGraphParams } from './AIGraph/sendMessage.js';

// Prevent the worker from exiting immediately
if (!isMainThread) {
  // Handler for incoming messages
  const messageHandler = async (data: CallGraphParams) => {
    try {
      const module = await import('./AIGraph/sendMessage.js');
      const callGraph = module.callGraph;
      
      // Execute callGraph
      const result = await callGraph(data);
      
      // Send result back to the main thread
      parentPort?.postMessage(result);
    } catch (error) {
      // Handle any errors during execution
      parentPort?.postMessage({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  };

  // Listen for messages
  parentPort?.on('message', messageHandler);

  // Optional: Log when the worker is ready
  console.log('Worker initialized and waiting for tasks');
}

export {};  // Ensure this is an ES module
