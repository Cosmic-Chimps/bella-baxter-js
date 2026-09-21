/*
|--------------------------------------------------------------------------
| Ace entrypoint
|--------------------------------------------------------------------------
|
| #733: package.json's `build`, `dev` and `start` scripts all named files that
| did not exist, so every script failed with MODULE_NOT_FOUND and the sample
| could neither run nor be copied. This is the standard AdonisJS 6 entrypoint:
| register the TypeScript loader, then hand over to bin/console.
|
*/

import { register } from 'node:module'
register('ts-node-maintained/esm', import.meta.url)

await import('./bin/console.js')
