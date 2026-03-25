import ngrok from 'ngrok';

const url = await ngrok.connect(3000);
console.log(`\nNGROK TUNNEL URL: ${url}`);
console.log(`\nSet this as your Twilio webhook:`);
console.log(`  ${url}/webhooks/sms`);
console.log(`\nPress Ctrl+C to stop the tunnel.\n`);

// Keep process alive
process.on('SIGINT', async () => {
  await ngrok.disconnect();
  await ngrok.kill();
  process.exit(0);
});

setInterval(() => {}, 60000);
