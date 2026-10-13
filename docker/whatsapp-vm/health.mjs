import http from "node:http";
const request = http.get({ socketPath: "/tmp/whatsapp-health.sock", path: "/", timeout: 3000 }, (response) => {
  response.resume(); process.exitCode = response.statusCode === 200 ? 0 : 1;
});
request.once("error", () => { process.exitCode = 1; });
request.once("timeout", () => request.destroy());
