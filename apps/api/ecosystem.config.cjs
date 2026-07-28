/**
 * pm2 process definition for the VPS.
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 start ecosystem.config.cjs --env staging
 *   pm2 save && pm2 startup     # survive reboots
 *
 * Secrets are NOT listed here — they come from apps/api/.env, which pm2 loads
 * because `start` runs node with --env-file.
 */
module.exports = {
  apps: [
    {
      name: 'crm-api',
      script: 'dist/server.js',
      node_args: '--env-file=.env',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      // Give the app a moment to finish in-flight requests on deploy.
      kill_timeout: 5000,
      env_production: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },
      env_staging: {
        NODE_ENV: 'production',
        APP_ENV: 'staging',
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
