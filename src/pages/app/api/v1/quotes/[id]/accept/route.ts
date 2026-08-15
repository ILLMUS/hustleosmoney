// app/api/v1/quotes/[id]/accept/route.ts
import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/integration/auth';
import { CanonicalSerializer } from '@/lib/integration/serializer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dispatchWebhookEvent } from '@/lib/integration/webhookDispatcher';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  const { error, auth } = await authenticateApiKey(apiKey, 'quotes.status', supabaseAdmin);

  if (error || !auth) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  // 1. Update status in documents table
  const { data: updatedDoc, error: updateError } = await supabaseAdmin
    .from('documents')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', auth.user_id)
    .select('*')
    .single();

  if (updateError || !updatedDoc) {
    return NextResponse.json({ error: 'Quote update failed or quote not found.' }, { status: 400 });
  }

  // 2. Fetch external reference details
  const { data: extRef } = await supabaseAdmin
    .from('quote_external_references')
    .select('*')
    .eq('document_id', updatedDoc.id)
    .maybeSingle();

  // 3. Serialize output
  const canonical = CanonicalSerializer.toCanonical(updatedDoc, extRef);

  // 4. 🔥 FIRE WEBHOOK to Business OS!
  await dispatchWebhookEvent(auth.user_id, 'quote.accepted', canonical);

  return NextResponse.json({
    message: 'Quote marked as ACCEPTED.',
    data: canonical,
  });
}