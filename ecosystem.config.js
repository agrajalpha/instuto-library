module.exports = {
  apps : [{
    name   : "instuto",
    script : "server/index.js",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}