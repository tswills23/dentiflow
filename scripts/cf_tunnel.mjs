import { exec } from 'child_process';

const child = exec('npx cloudflared tunnel --url http://localhost:3000', {
  cwd: process.cwd(),
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  // Look for the tunnel URL in cloudflared output
  const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    console.log(`\nTUNNEL URL: ${match[0]}`);
    console.log(`\nSet this as your Twilio webhook:`);
    console.log(`  ${match[0]}/webhooks/sms`);
    console.log('');
  }
  process.stderr.write(str);
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.on('exit', (code) => {
  console.log(`cloudflared exited with code ${code}`);
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  child.kill();
  process.exit(0);
});
