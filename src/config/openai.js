import OpenAI from 'openai';
import { File } from 'node:buffer';
import { loadConfig } from '../utils/load-config.js';

// Polyfill for Node.js < 20
if (!globalThis.File) {
  globalThis.File = File;
}

const config = loadConfig();

export const client = new OpenAI({ apiKey: config.openai.apiKey }); 