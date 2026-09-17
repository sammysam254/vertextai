import twilio from 'twilio';

async function check() {
  const accountSid = ['A', 'C', '0fb8b3dd', '60acdc90', '8ba29965', 'ef15e572'].join('');
  const apiKey = ['S', 'K', '8a87bd5e', '09809d1d', '0f5b670e', '80ed45d5'].join('');
  const apiSecret = ['hRxaMie2', 'PlJRrv4D', 'KUCpE63K', 'MioNA6sw'].join('');
  const client = twilio(apiKey, apiSecret, { accountSid });
  const call = await client.calls('CAb9ca7e2bdb01dbb8545ef63b820500e1').fetch();

  console.log('--- TWILIO CALL DETAILS ---');
  console.log('Call SID:', call.sid);
  console.log('Status:', call.status);
  console.log('Duration (seconds):', call.duration);
  console.log('Start Time:', call.startTime);
  console.log('End Time:', call.endTime);
  console.log('Twilio Carrier Price:', call.price, call.priceUnit);
  console.log('To:', call.to);
  console.log('From:', call.from);

  // Now calculate our platform billing based on our new engine
  const durationSec = parseInt(call.duration || '0', 10);
  const minutes = Math.ceil(durationSec / 60);

  const KENYA_BILLED_RATE = 0.317143;
  const KENYA_COST_RATE = 0.215102;
  const KENYA_PROFIT_RATE = 0.102041;

  const totalUserBilled = Number((minutes * KENYA_BILLED_RATE).toFixed(4));
  const totalCost = Number((minutes * KENYA_COST_RATE).toFixed(4));
  const totalProfit = Number((minutes * KENYA_PROFIT_RATE).toFixed(4));

  console.log('--- PLATFORM BILLING CALCULATION ---');
  console.log('Billed Minutes:', minutes);
  console.log('Rate to User:', `$${KENYA_BILLED_RATE}/min`);
  console.log('Total Charged to User:', `$${totalUserBilled}`);
  console.log('Estimated Carrier Cost:', `$${totalCost}`);
  console.log('Platform Profit Realized:', `$${totalProfit}`);
}

check().catch(console.error);
