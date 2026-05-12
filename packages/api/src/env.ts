function get(name: string, fallback?: string): string {
  const val = process.env[name];
  if (val !== undefined && val !== '') return val;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function getInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  return n;
}

// Validate required secrets at startup.
get('VLLM_API_KEY');

export const env = Object.freeze({
  NODE_ENV: get('NODE_ENV', 'development'),
  LOG_LEVEL: get('LOG_LEVEL', 'info'),

  API_HOST: get('API_HOST', '0.0.0.0'),
  API_PORT: getInt('API_PORT', 8080),
  API_RATE_LIMIT_MAX: getInt('API_RATE_LIMIT_MAX', 100),
  API_RATE_LIMIT_WINDOW: get('API_RATE_LIMIT_WINDOW', '1 minute'),

  VLLM_BASE_URL: get('VLLM_BASE_URL', 'http://localhost:11435/v1'),
  VLLM_API_KEY: get('VLLM_API_KEY'),
  VLLM_MODEL: get('VLLM_MODEL', 'qwen35-35b-a3b'),

  EMBEDDINGS_BASE_URL: get('EMBEDDINGS_BASE_URL', 'http://localhost:11436'),
  QDRANT_URL: get('QDRANT_URL', 'http://localhost:6333'),

  SQLITE_PATH: get('SQLITE_PATH', './data/memory.db'),
});
