import fs from 'fs';
import path from 'path';

interface OrderCounter {
  date: string;
  counter: number;
}

const COUNTER_FILE = path.join(__dirname, '../../data/order-counter.json');

// Ensure data directory exists
const ensureDataDir = () => {
  const dataDir = path.dirname(COUNTER_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Read counter from file
const readCounter = (): OrderCounter => {
  ensureDataDir();
  
  if (!fs.existsSync(COUNTER_FILE)) {
    return { date: getTodayDate(), counter: 0 };
  }

  try {
    const data = fs.readFileSync(COUNTER_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading order counter file:', error);
    return { date: getTodayDate(), counter: 0 };
  }
};

// Write counter to file
const writeCounter = (counter: OrderCounter): void => {
  ensureDataDir();
  
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter, null, 2));
  } catch (error) {
    console.error('Error writing order counter file:', error);
  }
};

// Get next order number (auto-resets daily)
export const getNextOrderNumber = (): number => {
  const today = getTodayDate();
  const counter = readCounter();

  // Reset counter if it's a new day
  if (counter.date !== today) {
    counter.date = today;
    counter.counter = 1;
  } else {
    counter.counter += 1;
  }

  writeCounter(counter);
  return counter.counter;
};

// Reset counter (for testing purposes)
export const resetOrderCounter = (): void => {
  writeCounter({ date: getTodayDate(), counter: 0 });
};
