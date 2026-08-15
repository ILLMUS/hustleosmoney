// src/services/hustleosIntegration.ts

// Read environment variables safely in Vite
const HUSTLEOS_API_URL = import.meta.env.VITE_HUSTLEOS_API_URL || 'https://api.hustleos.com';
const HUSTLEOS_API_KEY = import.meta.env.VITE_HUSTLEOS_API_KEY || '';

export interface SyncQuotePayload {
  sopDocumentId: string;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface SyncQuoteResponse {
  success: boolean;
  hustleInvoiceId: string;
  message?: string;
}

export async function syncQuoteToHustleOS(payload: SyncQuotePayload): Promise<SyncQuoteResponse> {
  // Mock response if no API URL/key configured yet during dev
  if (!HUSTLEOS_API_KEY) {
    console.warn('HustleOS API key not found. Simulating successful sync...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      success: true,
      hustleInvoiceId: `HUSTLE-${Math.floor(100000 + Math.random() * 900000)}`,
    };
  }

  const response = await fetch(`${HUSTLEOS_API_URL}/api/v1/quotes/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HUSTLEOS_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Sync failed with status ${response.status}`);
  }

  return await response.json();
}