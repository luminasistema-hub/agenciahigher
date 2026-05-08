import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, invoiceId, asaasPayload } = await req.json()
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    // Fallback if env vars missing (for direct manual payload or tests context if needed)
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // 1. Get Settings (Asaas API Key)
    const { data: settingsList } = await supabaseAdmin.from('financial_settings').select('asaas_api_key').limit(1)
    const settings = settingsList && settingsList.length > 0 ? settingsList[0] : null;
    if (!settings || !settings.asaas_api_key) {
      throw new Error("Asaas API Key não configurada no painel financeiro.")
    }

    const ASAAS_KEY = settings.asaas_api_key;
    const API_URL = ASAAS_KEY.includes('sandbox') ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

    // Helper fetch
    const asaasFetch = async (endpoint, method = 'GET', body = null) => {
      const resp = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_KEY
        },
        body: body ? JSON.stringify(body) : undefined
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.errors?.[0]?.description || `Erro Asaas: ${resp.status}`)
      return data
    }

    // ------------------------------------------------------------------------------------------------
    // ACTION: SYNC CUSTOMER
    // ------------------------------------------------------------------------------------------------
    if (action === 'sync_customer') {
      const { data: client } = await supabaseAdmin.from('clients').select('*').eq('id', invoiceId).single() // in this case invoiceId is clientId
      if (!client) throw new Error("Cliente não encontrado.")

      const payload = {
        name: client.company || client.name,
        email: client.email || 'nao-informado@agenciahigher.com',
        phone: client.whatsapp || '',
        mobilePhone: client.whatsapp || '',
        cpfCnpj: client.document || '',
        postalCode: client.postal_code || '',
        addressNumber: client.address_number || '',
        notificationDisabled: false
      }

      let customerId = client.asaas_customer_id
      if (customerId) {
        await asaasFetch(`/customers/${customerId}`, 'POST', payload)
      } else {
        const custData = await asaasFetch('/customers', 'POST', payload)
        customerId = custData.id
        await supabaseAdmin.from('clients').update({ asaas_customer_id: customerId }).eq('id', client.id)
      }
      return new Response(JSON.stringify({ success: true, customerId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------------------------------------
    // ACTION: CREATE INVOICE / TICKET
    // ------------------------------------------------------------------------------------------------
    if (action === 'create_invoice' && invoiceId) {
      // Get full invoice + client info
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select(`*, clients(*)`)
        .eq('id', invoiceId)
        .single()

      if (!invoice) throw new Error("Fatura não encontrada.")
      const client = invoice.clients;

      // 1. RESOLVE & UPDATE ASAAS CUSTOMER ID
      let customerId = client.asaas_customer_id;
      const custPayload = {
        name: client.company || client.name,
        email: client.email || 'nao-informado@agenciahigher.com',
        phone: client.whatsapp || '',
        mobilePhone: client.whatsapp || '',
        cpfCnpj: client.document || '',
        postalCode: client.postal_code || '',
        addressNumber: client.address_number || '',
        notificationDisabled: false
      }

      if (!customerId) {
        // Create customer in Asaas
        const custData = await asaasFetch('/customers', 'POST', custPayload)
        customerId = custData.id;
        // Update DB
        await supabaseAdmin.from('clients').update({ asaas_customer_id: customerId }).eq('id', client.id)
      } else {
        // Ensure customer is up to date before creating invoice
        try {
          await asaasFetch(`/customers/${customerId}`, 'POST', custPayload)
        } catch (e) {
          console.error("Erro ao atualizar cliente, tentando prosseguir:", e.message)
        }
      }

      // 2. CREATE PAYMENT OR SUBSCRIPTION
      const billingType = invoice.payment_method === 'pix' ? 'PIX' : (invoice.payment_method === 'cartao' ? 'CREDIT_CARD' : 'BOLETO');
      
      let finalLink = "";
      let asaasInvId = "";
      
      if (invoice.is_recurring) {
        // Subscription (Assinatura)
        const cycleMap: any = { 'monthly': 'MONTHLY', 'quarterly': 'QUARTERLY', 'yearly': 'YEARLY' };
        let descriptionItems = "Gerenciamento e Serviços";
        
        const subData = await asaasFetch('/subscriptions', 'POST', {
          customer: customerId,
          billingType: billingType,
          nextDueDate: invoice.due_date,
          value: invoice.total,
          cycle: cycleMap[invoice.recurrence] || 'MONTHLY',
          description: `Assinatura ${invoice.invoice_number} - Higher`
        })
        asaasInvId = subData.id;
        finalLink = subData.paymentUrl || `https://www.asaas.com/c/${asaasInvId}`;

      } else {
        // Single Charge (Cobrança Avulsa)
        const payData = await asaasFetch('/payments', 'POST', {
          customer: customerId,
          billingType: billingType,
          dueDate: invoice.due_date,
          value: invoice.total,
          description: `Fatura ${invoice.invoice_number} - Higher`,
          externalReference: invoice.invoice_number
        })
        asaasInvId = payData.id;
        finalLink = payData.invoiceUrl;
      }

      // 3. Update Invoice in Database
      await supabaseAdmin.from('invoices').update({
        asaas_invoice_id: asaasInvId,
        asaas_payment_url: finalLink,
        status: 'sent', // Since link is generated, consider it sent
      }).eq('id', invoiceId)

      return new Response(JSON.stringify({ success: true, url: finalLink, asaas_id: asaasInvId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })

  } catch (error: any) {
    console.error("Asaas Edge Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
