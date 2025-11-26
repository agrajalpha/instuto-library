module.exports = {
  apps : [
    {
      name   : "instuto-api",
      script : "server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name   : "instuto-client",
      script : "npm",
      args   : "run preview",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}