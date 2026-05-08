import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  try {
    const payload = await req.json()
    const event = payload.event
    const payment = payload.payment

    // Config Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // Check access token (Security pass from Asaas)
    const asaasToken = req.headers.get('asaas-access-token')
    const { data: settingsList } = await supabaseAdmin.from('financial_settings').select('asaas_webhook_token').limit(1)
    const settings = settingsList && settingsList.length > 0 ? settingsList[0] : null
    
    if (settings?.asaas_webhook_token && asaasToken !== settings.asaas_webhook_token) {
      console.warn("Token de webhook inválido recebido.")
      return new Response("Unauthorized", { status: 401 })
    }

    // Log the event
    await supabaseAdmin.from('webhook_logs').insert([{ 
      source: 'asaas', 
      event_type: event, 
      payload: payload 
    }])

    // 1. Pagamentos CONFIRMADOS ou RECEBIDOS
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      const asaasInvId = payment.id

      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('id, status, invoice_number')
        .eq('asaas_invoice_id', asaasInvId)
        .single()

      if (invoice && invoice.status !== 'paid') {
        const payMethodMap: any = { 'PIX': 'pix', 'BOLETO': 'boleto', 'CREDIT_CARD': 'cartao' }
        
        await supabaseAdmin.from('payments').insert([{
          invoice_id: invoice.id,
          amount: payment.value,
          paid_at: new Date(payment.paymentDate || new Date()).toISOString(),
          method: payMethodMap[payment.billingType] || 'outro',
          reference: asaasInvId,
          notes: `Pago automaticamente via Asaas (${event})`
        }])
      }
    }

    // 2. Pagamento VENCIDO
    if (event === 'PAYMENT_OVERDUE') {
      const asaasInvId = payment.id
      await supabaseAdmin
        .from('invoices')
        .update({ status: 'overdue' })
        .eq('asaas_invoice_id', asaasInvId)
        .neq('status', 'paid')
    }

    // 3. Pagamento DELETADO ou ESTORNADO
    if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      const asaasInvId = payment.id
      const { data: invoice } = await supabaseAdmin.from('invoices').select('id').eq('asaas_invoice_id', asaasInvId).single()
      
      if (invoice) {
        await supabaseAdmin.from('invoices').update({ status: 'cancelled' }).eq('id', invoice.id)
        if (event === 'PAYMENT_REFUNDED') {
          await supabaseAdmin.from('payments').delete().eq('invoice_id', invoice.id)
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("Webhook Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
