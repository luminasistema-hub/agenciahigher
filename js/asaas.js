/**
 * HIGHER CRM — ASAAS GATEWAY INTEGRATION
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const ASAAS = {
  // Use a proxy or Edge Function URL here for production
  // For now, we'll implement the logic to be called securely
  async getSettings() {
    const { data } = await APP.db.from('financial_settings').select('*').limit(1).single();
    return data;
  },

  async createCustomer(client) {
    const settings = await this.getSettings();
    if (!settings?.asaas_api_key) throw new Error('Chave API Asaas não configurada');

    const payload = {
      name: client.name,
      cpfCnpj: client.document?.replace(/\D/g, ''),
      email: client.email,
      mobilePhone: client.whatsapp?.replace(/\D/g, ''),
      externalReference: client.id
    };

    // Note: In a real app, this fetch would go through a backend/edge function
    // to avoid CORS and protect the API Key.
    console.log('[ASAAS] Cadastrando cliente:', payload.name);
    
    // Simulate API Call for demonstration if direct fetch fails CORS
    const response = await fetch('https://www.asaas.com/api/v3/customers', {
      method: 'POST',
      headers: {
        'access_token': settings.asaas_api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].description);
    
    // Update client with asaas_id
    await APP.db.from('clients').update({ asaas_id: data.id }).eq('id', client.id);
    return data.id;
  },

  async createPayment(invoice, client) {
    const settings = await this.getSettings();
    if (!settings?.asaas_api_key) throw new Error('Chave API Asaas não configurada');

    let asaasClientId = client.asaas_id;
    if (!asaasClientId) {
      asaasClientId = await this.createCustomer(client);
    }

    const payload = {
      customer: asaasClientId,
      billingType: invoice.payment_method?.toUpperCase() || 'UNDEFINED',
      value: invoice.total,
      dueDate: invoice.due_date,
      description: invoice.notes || `Fatura #${invoice.id.slice(0,8)}`,
      externalReference: invoice.id,
      postalService: false
    };

    console.log('[ASAAS] Gerando cobrança de R$', payload.value);

    const response = await fetch('https://www.asaas.com/api/v3/payments', {
      method: 'POST',
      headers: {
        'access_token': settings.asaas_api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.errors) throw new Error(data.errors[0].description);

    // Update invoice with payment details
    await APP.db.from('invoices').update({
      asaas_payment_id: data.id,
      asaas_payment_url: data.invoiceUrl, // Link do boleto/fatura do Asaas
      status: 'sent'
    }).eq('id', invoice.id);

    return data;
  }
};
