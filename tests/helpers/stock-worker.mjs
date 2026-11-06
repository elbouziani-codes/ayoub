import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase, reserveOrder } from './database.mjs';
const db = openDatabase(workerData.path, false);
try {
  reserveOrder(db, workerData.id, workerData.id, [{ id: 'shared', quantity: 1, price: 650 }]);
  parentPort.postMessage({ success: true });
} catch (error) {
  parentPort.postMessage({ success: false, message: error.message });
} finally { db.close(); }
