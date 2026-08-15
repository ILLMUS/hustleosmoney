// app/api/v1/quotes/[id]/reject/route.ts
import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/integration/auth';
import { CanonicalSerializer } from '@/lib/integration/serializer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dispatchWebhookEvent } from '@/lib/integration/webhookDispatcher';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await params;
    const quoteId = resolvedParams.id;

    // 1. Extract API key from headers
    const apiKey =
      req.headers.get('x-api-key') ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    // 2. Validate API key and check for 'quotes.status' scope
    const { error: authError, auth } = await authenticateApiKey(
      apiKey,
      'quotes.status',
      supabaseAdmin
    );

    if (authError || !auth) {
      return NextResponse.json(
        { error: authError || 'Unauthorized: Invalid or missing API Key.' },
        { status: 401 }
      );
    }

    // 3. Update status to 'rejected' in documents table
    const { data: updatedDoc, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .eq('user_id', auth.user_id)
      .select('*')
      .single();

    if (updateError || !updatedDoc) {
      return NextResponse.json(
        { error: 'Quote update failed or quote not found.' },
        { status: 400 }
      );
    }

    // 4. Fetch linked external metadata
    const { data: extRef } = await supabaseAdmin
      .from('quote_external_references')
      .select('*')
      .eq('document_id', updatedDoc.id)
      .maybeSingle();

    // 5. Transform database record into standard canonical JSON
    const canonical = CanonicalSerializer.toCanonical(updatedDoc, extRef);

    // 6. Fire webhook event to Business OS
    await dispatchWebhookEvent(auth.user_id, 'quote.rejected', canonical);

    return NextResponse.json({
      success: true,
      message: 'Quote marked as REJECTED.',
      data: canonical,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}