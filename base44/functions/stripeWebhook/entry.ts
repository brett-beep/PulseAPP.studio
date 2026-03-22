import Stripe from 'npm:stripe@17.5.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-12-18.acacia',
});

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    console.error('❌ Missing signature or webhook secret');
    return Response.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log('✅ Webhook verified:', event.type);
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userEmail = session.metadata?.user_email || session.customer_email;
        
        console.log('💳 Checkout completed for:', userEmail);
        
        if (userEmail) {
          const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ 
            created_by: userEmail 
          });
          
          if (prefs[0]) {
            await base44.asServiceRole.entities.UserPreferences.update(prefs[0].id, {
              is_premium: true,
              subscription_status: 'active',
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            });
            console.log('✅ User upgraded to premium:', userEmail);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userEmail = subscription.metadata?.user_email;
        
        if (userEmail) {
          const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ 
            created_by: userEmail 
          });
          
          if (prefs[0]) {
            await base44.asServiceRole.entities.UserPreferences.update(prefs[0].id, {
              subscription_status: subscription.status,
              is_premium: subscription.status === 'active',
            });
            console.log('✅ Subscription updated:', userEmail, subscription.status);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userEmail = subscription.metadata?.user_email;
        
        if (userEmail) {
          const prefs = await base44.asServiceRole.entities.UserPreferences.filter({ 
            created_by: userEmail 
          });
          
          if (prefs[0]) {
            await base44.asServiceRole.entities.UserPreferences.update(prefs[0].id, {
              is_premium: false,
              subscription_status: 'cancelled',
            });
            console.log('✅ Subscription cancelled:', userEmail);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscription = invoice.subscription;
        
        console.log('⚠️ Payment failed for subscription:', subscription);
        break;
      }

      default:
        console.log('ℹ️ Unhandled event type:', event.type);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});