/* eslint-disable no-console */
const required = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
];

let ok = true;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env variable: ${key}`);
    ok = false;
  }
}

if (!ok) {
  console.error('\n👉 Set the missing variables and try again.');
  process.exit(1);
}
console.log('✅ All required environment variables are present.');