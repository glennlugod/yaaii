import { dirname, join } from 'path';

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';

// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Enhanced worker pool management
export class WorkerPool {
  private workers: Worker[] = [];
  private readonly availableWorkers: Set<Worker> = new Set();
  private readonly maxWorkers: number;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = maxWorkers;
    this.initializeWorkers();
  }

  private initializeWorkers() {
    this.workers = Array.from({ length: this.maxWorkers }, () => {
      const workerPath = join(__dirname, 'worker.js');
      const worker = new Worker(workerPath);
      
      worker.on('error', (error) => {
        console.error('Worker error:', error);
        this.removeWorker(worker);
      });

      worker.on('exit', (code) => {
        console.info(`Worker exited with code ${code}`);
        this.removeWorker(worker);
      });

      this.availableWorkers.add(worker);
      return worker;
    });
  }

  private removeWorker(worker: Worker) {
    this.availableWorkers.delete(worker);
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }
  }

  getWorker(): Worker | null {
    if (this.availableWorkers.size === 0) {
      return null;
    }
    const worker = Array.from(this.availableWorkers)[0];
    this.availableWorkers.delete(worker);
    return worker;
  }

  releaseWorker(worker: Worker) {
    this.availableWorkers.add(worker);
  }

  terminateAll() {
    this.workers.forEach(worker => {
      try {
        worker.terminate();
      } catch (error) {
        console.error('Error terminating worker:', error);
      }
    });
    this.workers = [];
    this.availableWorkers.clear();
  }
}
