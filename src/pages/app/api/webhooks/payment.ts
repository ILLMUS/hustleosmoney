// Received when HustleOS notifies BusinessOS that an invoice was paid
export async function handleHustleOSPaymentWebhook(req: Request) {
  const { sopDocumentId, paymentStatus } = await req.json();

  // Update document status in BusinessOS DB (e.g. mark as 'Paid' / 'Approved')
  console.log(`Document ${sopDocumentId} updated to status: ${paymentStatus}`);
  
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}