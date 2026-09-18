module.exports = {
  apps: [{
    name: 'sodruzhestvo',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
