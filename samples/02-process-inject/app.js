/**
 * Sample app — shows process.env access when started via bella run.
 *
 * Start with: bella run -p my-project -e production -- node app.js
 */

const mask = (v, n = 4) => (v && v.length > n ? v.slice(0, n) + '***' : v ?? '(not set)');

console.log('=== Bella Baxter: process inject sample ===');
console.log(`PORT                      : ${process.env.PORT                      ?? '(not set)'}`);
console.log(`DATABASE_URL              : ${process.env.DATABASE_URL              ?? '(not set)'}`);
console.log(`EXTERNAL_API_KEY          : ${mask(process.env.EXTERNAL_API_KEY)}`);
console.log(`GLEAP_API_KEY             : ${mask(process.env.GLEAP_API_KEY)}`);
console.log(`ENABLE_FEATURES           : ${process.env.ENABLE_FEATURES           ?? '(not set)'}`);
console.log(`APP_ID                    : ${process.env.APP_ID                    ?? '(not set)'}`);
console.log(`ConnectionStrings__Postgres: ${mask(process.env.ConnectionStrings__Postgres, 6)}`);
console.log(`APP_CONFIG                : ${process.env.APP_CONFIG                ?? '(not set)'}`);

