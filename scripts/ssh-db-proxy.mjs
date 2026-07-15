import net from "node:net";
import { spawn } from "node:child_process";

const localHost = process.env.SSH_DB_PROXY_LOCAL_HOST || "127.0.0.1";
const localPort = Number(process.env.SSH_DB_PROXY_LOCAL_PORT || "5433");
const keyPath =
  process.env.SSH_DB_PROXY_KEY || "C:/Users/Arjun/Downloads/new_velo_key.pem";
const sshTarget = process.env.SSH_DB_PROXY_TARGET || "ubuntu@35.154.138.184";
const remoteHost = process.env.SSH_DB_PROXY_REMOTE_HOST || "127.0.0.1";
const remotePort = process.env.SSH_DB_PROXY_REMOTE_PORT || "5432";

const sshArgs = [
  "-i",
  keyPath,
  "-o",
  "BatchMode=yes",
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "ServerAliveInterval=60",
  sshTarget,
  "nc",
  remoteHost,
  remotePort,
];

const server = net.createServer((socket) => {
  const ssh = spawn("ssh.exe", sshArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  socket.pipe(ssh.stdin);
  ssh.stdout.pipe(socket);
  ssh.stderr.on("data", (data) => process.stderr.write(data));

  const close = () => {
    socket.destroy();
    if (!ssh.killed) ssh.kill();
  };

  socket.on("error", close);
  socket.on("close", close);
  ssh.on("error", close);
  ssh.on("close", close);
});

server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

server.listen(localPort, localHost, () => {
  console.log(
    `ssh nc db proxy listening on ${localHost}:${localPort} -> ${sshTarget} ${remoteHost}:${remotePort}`,
  );
});
