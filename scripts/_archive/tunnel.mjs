import localtunnel from 'localtunnel';

const tunnel = await localtunnel({ port: 3000 });

console.log(`\nTUNNEL URL: ${tunnel.url}`);
console.log(`\nSet this as your Twilio webhook:`);
console.log(`  ${tunnel.url}/webhooks/sms`);
console.log(`\nPress Ctrl+C to stop.\n`);

tunnel.on('close', () => {
  console.log('Tunnel closed');
  process.exit(0);
});

process.on('SIGINT', () => {
  tunnel.close();
  process.exit(0);
});
