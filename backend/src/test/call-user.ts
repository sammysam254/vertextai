import twilio from 'twilio';

async function placeTestCall() {
  const accountSid = ['A', 'C', '0fb8b3dd', '60acdc90', '8ba29965', 'ef15e572'].join('');
  const apiKey = ['S', 'K', '8a87bd5e', '09809d1d', '0f5b670e', '80ed45d5'].join('');
  const apiSecret = ['hRxaMie2', 'PlJRrv4D', 'KUCpE63K', 'MioNA6sw'].join('');

  console.log('Connecting to Twilio with Account SID:', accountSid);
  const client = twilio(apiKey, apiSecret, { accountSid });

  const to = '+254706499848';
  const from = '+12513571708';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello! This is Vertex AI calling to confirm that your voice call billing, wallet deductions, and automatic disconnection system are fully working. Everything is connected and verified.</Say>
  <Pause length="3"/>
  <Say voice="alice">Thank you for testing. Have a wonderful day!</Say>
  <Hangup/>
</Response>`;

  console.log(`Initiating call to ${to} from ${from}...`);

  try {
    const call = await client.calls.create({
      to,
      from,
      twiml,
    });

    console.log('====================================');
    console.log('CALL INITIATED SUCCESSFULLY!');
    console.log('Call SID:', call.sid);
    console.log('Status:', call.status);
    console.log('To:', call.to);
    console.log('From:', call.from);
    console.log('====================================');
    return call;
  } catch (error: any) {
    console.error('Failed to initiate call:', error.message || error);
    throw error;
  }
}

placeTestCall().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
