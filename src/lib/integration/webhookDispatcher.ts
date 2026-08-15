// lib/integration/webhookDispatcher.ts
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { CanonicalQuote } from '@/types/integration';

export type WebhookEventType = 'quote.accepted' | 'quote.rejected' | 'quote.created' | 'quote.updated';

export async function dispatchWebhookEvent(
  userId: string,
  eventType: WebhookEventType,
  canonicalQuote: CanonicalQuote
) {
  // 1. Fetch active webhook subscriptions for this user listening to this event
  const { data: subscriptions } = await supabaseAdmin
    .from('webhook_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!subscriptions || subscriptions.length === 0) {
    return; // No webhooks registered
  }

  const payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: canonicalQuote,
  };

  const payloadString = JSON.stringify(payload);

  // 2. Dispatch to each target URL (e.g. Business OS)
  for (const sub of subscriptions) {
    // Check if the subscription wants this event or 'all'
    if (!sub.events.includes(eventType) && !sub.events.includes('*')) {
      continue;
    }

    // Generate HMAC SHA-256 signature using the subscription secret
    const signature = crypto
      .createHmac('sha256', sub.secret || 'default_secret')
      .update(payloadString)
      .digest('hex');

    let statusCode = 500;
    let responseText = '';

    try {
      const response = await fetch(sub.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-256': signature,
          'X-Event-Type': eventType,
        },
        body: payloadString,
      });

      statusCode = response.status;
      responseText = await response.text();
    } catch (err: any) {
      responseText = err.message || 'Network dispatch error';
    }

    // 3. Log execution to integration_logs for Business OS / Admin to view
    await supabaseAdmin.from('integration_logs').insert([{
      user_id: userId,
      direction: 'outbound',
      event_type: eventType,
      target_url: sub.target_url,
      payload: payload,
      status_code: statusCode,
      response_body: responseText,
    }]);
  }
}