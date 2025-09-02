import dotenv from 'dotenv';
import path from 'path';

/**
 * Load configuration based on NODE_ENV environment variable
 * @returns {Object} Configuration object for the current environment
 */
export function loadConfig() {
  const environment = process.env.NODE_ENV || 'localhost';
  
  // Load environment-specific .env file
  const envFile = `.env.${environment}`;
  const envPath = path.resolve(process.cwd(), envFile);
  
  // Load the environment file
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.warn(`⚠️ Could not load ${envFile}, falling back to process.env`);
  }
  
  // Build configuration object from environment variables
  const config = {
    environment: process.env.NODE_ENV || 'localhost',
    server: {
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || 'localhost'
    },
    storage: {
      type: process.env.STORAGE_TYPE || 'filesystem',
      config: buildStorageConfig()
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-transcribe',
      extractionModel: process.env.OPENAI_EXTRACTION_MODEL || 'gpt-5'
    },
    timezone: process.env.TIMEZONE || 'Asia/Kolkata',
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      enableConsole: process.env.LOG_ENABLE_CONSOLE === 'true'
    }
  };
  
  console.log(`🔧 Loaded configuration for environment: ${config.environment}`);
  
  // Validate required configuration
  validateConfig(config);
  
  return config;
}

/**
 * Build storage configuration based on storage type
 * @returns {Object} Storage configuration object
 */
function buildStorageConfig() {
  const storageType = process.env.STORAGE_TYPE || 'filesystem';
  
  if (storageType === 's3') {
    return {
      bucketName: process.env.S3_BUCKET_NAME,
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      candidateDataPrefix: process.env.S3_CANDIDATE_DATA_PREFIX || 'candidate-data',
      processedDataPrefix: process.env.S3_PROCESSED_DATA_PREFIX || 'processed-data'
    };
  } else {
    return {
      candidateDataPath: process.env.CANDIDATE_DATA_PATH || 'candidate-data',
      processedDataPath: process.env.PROCESSED_DATA_PATH || 'processed-data'
    };
  }
}

/**
 * Validate that required configuration is present
 * @param {Object} config - Configuration object to validate
 */
function validateConfig(config) {
  const required = [
    'server.port',
    'storage.type',
    'openai.apiKey',
    'timezone'
  ];
  
  for (const path of required) {
    const value = getNestedValue(config, path);
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required configuration: ${path}`);
    }
  }
  
  // Validate storage-specific configuration
  if (config.storage.type === 's3') {
    const s3Required = [
      'storage.config.bucketName',
      'storage.config.region',
      'storage.config.accessKeyId',
      'storage.config.secretAccessKey'
    ];
    
    for (const path of s3Required) {
      const value = getNestedValue(config, path);
      if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required S3 configuration: ${path}`);
      }
    }
  } else if (config.storage.type === 'filesystem') {
    const fsRequired = [
      'storage.config.candidateDataPath',
      'storage.config.processedDataPath'
    ];
    
    for (const path of fsRequired) {
      const value = getNestedValue(config, path);
      if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required filesystem configuration: ${path}`);
      }
    }
  }
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Dot notation path (e.g., 'server.port')
 * @returns {*} Value at the specified path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Get current environment name
 * @returns {string} Current environment name
 */
export function getCurrentEnvironment() {
  return process.env.NODE_ENV || 'localhost';
}

/**
 * Check if running in a specific environment
 * @param {string} environment - Environment name to check
 * @returns {boolean} True if current environment matches
 */
export function isEnvironment(environment) {
  return getCurrentEnvironment() === environment;
}

export default loadConfig; 