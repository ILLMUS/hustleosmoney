import dotenv from 'dotenv';
// Load .env.local first, then fall back to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import cors from 'cors';
import { authenticateApiKey } from './src/lib/integration/auth';
import { CanonicalSerializer } from './src/lib/integration/serializer';
import { supabaseAdmin } from './src/lib/supabaseAdmin';

const app = express();
app.use(cors());
app.use(express.json());

// 1. CREATE QUOTE (POST /api/v1/quotes)
app.post('/api/v1/quotes', async (req, res) => {
  try {
    const apiKey = (req.headers['x-api-key'] as string) || (req.headers['authorization']?.replace('Bearer ', ''));

    console.log('🔑 Received API Key:', apiKey);

    // Validate API Key
    let { error: authError, auth } = await authenticateApiKey(
      apiKey,
      'quotes.create',
      supabaseAdmin
    );

    // 🛠️ DEV MODE BYPASS: Automatically allow testkey123 during local development
    if (apiKey === 'BUSINESSOS_LIVE_testkey123' && authError) {
      console.log('⚠️ Local Dev Mode: Bypassing auth check for test key.');
      authError = null;
      auth = { 
        user_id: '00000000-0000-0000-0000-000000000000', 
        system_name: 'rst_business_os' 
      } as any;
    }

    if (authError || !auth) {
      console.log('❌ Auth Failed:', authError);
      return res.status(401).json({ error: authError || 'Unauthorized: Invalid or missing API Key.' });
    }

    const body = req.body;

    if (!body.customer?.name || !body.items || body.items.length === 0) {
      return res.status(400).json({ error: 'Validation Error: Customer name and line items are required.' });
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QUO-${year}-${randomSuffix}`;

    const internalDocPayload = CanonicalSerializer.toInternalDocument(
      body,
      auth.user_id,
      quoteNumber
    );

    const { data: newDoc, error: docError } = await supabaseAdmin
      .from('documents')
      .insert([internalDocPayload])
      .select('*')
      .single();

    if (docError || !newDoc) {
      return res.status(500).json({ error: 'Failed to create quote record in database.', details: docError });
    }

    let extRefData = null;
    if (body.external_reference?.system && body.external_reference?.record_id) {
      const { data: ref } = await supabaseAdmin
        .from('quote_external_references')
        .insert([
          {
            document_id: newDoc.id,
            external_system: body.external_reference.system,
            external_record_type: body.external_reference.record_type,
            external_record_id: body.external_reference.record_id,
            metadata: body.external_reference.metadata || {},
          },
        ])
        .select('*')
        .single();

      extRefData = ref;
    }

    const canonicalResponse = CanonicalSerializer.toCanonical(newDoc, extRefData);

    return res.status(201).json({ success: true, data: canonicalResponse });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// 2. FETCH QUOTE DETAILS (GET /api/v1/quotes/:id)
app.get('/api/v1/quotes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !doc) return res.status(404).json({ error: 'Quote not found.' });

    return res.json({ success: true, data: doc });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. ACCEPT QUOTE (POST /api/v1/quotes/:id/accept)
app.post('/api/v1/quotes/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('documents')
      .update({ status: 'accepted' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. REJECT QUOTE (POST /api/v1/quotes/:id/reject)
app.post('/api/v1/quotes/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('documents')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// START SERVER ON PORT 8080
app.listen(8080, () => {
  console.log('🚀 API Server running at http://localhost:8080');
});