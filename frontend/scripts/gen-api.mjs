// Generates src/lib/api/schema.d.ts from the backend's OpenAPI document.
// Usage: npm run gen:api            (reads http://localhost:8000/openapi.json)
//        OPENAPI_SOURCE=path/or/url npm run gen:api
import { spawnSync } from 'node:child_process';

const source = process.env.OPENAPI_SOURCE || 'http://localhost:8000/openapi.json';
const bin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(bin, ['openapi-typescript', source, '-o', 'src/lib/api/schema.d.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
