import 'dotenv/config';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

async function main() {
  console.log('=== Twilio Account Snapshot ===');
  console.log('Account SID:', accountSid);
  console.log('');

  const account = await client.api.v2010.accounts(accountSid!).fetch();
  console.log('Account:');
  console.log('  friendlyName:', account.friendlyName);
  console.log('  type:', account.type);
  console.log('  status:', account.status);
  console.log('');

  console.log('=== Trust Hub: Primary Customer Profile ===');
  try {
    const primaryProfiles = await client.trusthub.v1.customerProfiles.list({ limit: 20 });
    if (primaryProfiles.length === 0) {
      console.log('  NONE — no Trust Hub Primary Customer Profile found');
    } else {
      for (const p of primaryProfiles) {
        console.log(`  - friendlyName: ${p.friendlyName}`);
        console.log(`    sid: ${p.sid}`);
        console.log(`    status: ${p.status}`);
        console.log(`    policySid: ${p.policySid}`);
        console.log('');
      }
    }
  } catch (e: any) {
    console.log('  ERROR fetching customer profiles:', e.message);
  }

  console.log('=== Trust Hub: Secondary Customer Profiles (ISV sub-accounts) ===');
  try {
    const trustProducts = await client.trusthub.v1.trustProducts.list({ limit: 20 });
    if (trustProducts.length === 0) {
      console.log('  NONE — no secondary trust products');
    } else {
      for (const tp of trustProducts) {
        console.log(`  - friendlyName: ${tp.friendlyName}`);
        console.log(`    sid: ${tp.sid}`);
        console.log(`    status: ${tp.status}`);
        console.log(`    policySid: ${tp.policySid}`);
        console.log('');
      }
    }
  } catch (e: any) {
    console.log('  ERROR fetching trust products:', e.message);
  }

  console.log('=== A2P 10DLC: Brand Registrations ===');
  try {
    const brands = await client.messaging.v1.brandRegistrations.list({ limit: 20 });
    if (brands.length === 0) {
      console.log('  NONE — no A2P brand registrations found');
    } else {
      for (const b of brands) {
        console.log(`  - sid: ${b.sid}`);
        console.log(`    status: ${b.status}`);
        console.log(`    brandType: ${b.brandType}`);
        console.log(`    failureReason: ${b.failureReason || 'n/a'}`);
        console.log(`    customerProfileBundleSid: ${b.customerProfileBundleSid}`);
        console.log(`    a2PProfileBundleSid: ${b.a2PProfileBundleSid}`);
        console.log(`    identityStatus: ${b.identityStatus}`);
        console.log(`    russell3000: ${b.russell3000}`);
        console.log(`    taxExemptStatus: ${b.taxExemptStatus}`);
        console.log(`    brandScore: ${b.brandScore}`);
        console.log('');
      }
    }
  } catch (e: any) {
    console.log('  ERROR fetching brand registrations:', e.message);
  }

  console.log('=== Messaging Services & Campaigns ===');
  try {
    const services = await client.messaging.v1.services.list({ limit: 20 });
    if (services.length === 0) {
      console.log('  NONE — no Messaging Services found');
    } else {
      for (const s of services) {
        console.log(`  Service: ${s.friendlyName}  (${s.sid})`);
        console.log(`    useCase: ${s.usecase || 'n/a'}`);
        try {
          const compliance = await client.messaging.v1.services(s.sid).usAppToPerson.list({ limit: 5 });
          if (compliance.length === 0) {
            console.log('    A2P Campaign: NONE');
          } else {
            for (const c of compliance) {
              console.log(`    A2P Campaign sid: ${c.sid}`);
              console.log(`      campaignStatus: ${c.campaignStatus}`);
              console.log(`      usAppToPersonUsecase: ${c.usAppToPersonUsecase}`);
              console.log(`      brandRegistrationSid: ${c.brandRegistrationSid}`);
            }
          }
        } catch (e: any) {
          console.log('    A2P Campaign fetch error:', e.message);
        }
        console.log('');
      }
    }
  } catch (e: any) {
    console.log('  ERROR fetching messaging services:', e.message);
  }

  console.log('=== Phone Numbers on Account ===');
  try {
    const numbers = await client.incomingPhoneNumbers.list({ limit: 50 });
    console.log(`  Total: ${numbers.length}`);
    for (const n of numbers) {
      const isTollFree = /^\+1(800|833|844|855|866|877|888)/.test(n.phoneNumber);
      console.log(`  - ${n.phoneNumber}  ${isTollFree ? '[TOLL-FREE]' : '[10DLC]'}  ${n.friendlyName}`);
    }
  } catch (e: any) {
    console.log('  ERROR fetching numbers:', e.message);
  }

  console.log('');
  console.log('=== Toll-Free Verifications ===');
  try {
    const tfVerifications = await client.messaging.v1.tollfreeVerifications.list({ limit: 20 });
    if (tfVerifications.length === 0) {
      console.log('  NONE');
    } else {
      for (const tv of tfVerifications) {
        console.log(`  - businessName: ${tv.businessName}`);
        console.log(`    status: ${tv.status}`);
        console.log(`    tollfreePhoneNumberSid: ${tv.tollfreePhoneNumberSid}`);
      }
    }
  } catch (e: any) {
    console.log('  ERROR fetching toll-free verifications:', e.message);
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
