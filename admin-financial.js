/* ============================================================
   HIGHER CRM — FINANCIAL MODULE JS
   Invoices, Payments, MRR, Financial Settings
   ============================================================ */

'use strict';

/* ============================================================
   FINANCIAL STATE
   ============================================================ */
const FIN = {
  invoices:  [],
  payments:  {},   // { invoice_id: [payments] }
  settings:  null,
  filter: { status: '', client: '', search: '' },
  editingInvoice: null,   // invoice being created/edited
  items: [],              // line items for current invoice
  products: [],           // products/catalog
};

/* ============================================================
   LOAD FINANCIAL DATA
   ============================================================ */
async function loadFinancial() {
  await Promise.all([
    loadInvoices(),
    loadFinancialSettings(),
    loadFinancialDashboard(),
    loadProducts(),
  ]);
}

async function loadProducts() {
  const { data } = await APP.db.from('products').select('*').eq('is_active', true).order('name');
  if (data) FIN.products = data;
}

async function loadInvoices() {
  const { data, error } = await APP.db
    .from('invoices')
    .select('*, clients(name, email, whatsapp), projects(name), invoice_items(*)')
    .order('created_at', { ascending: false });

  if (error) { console.error('[FIN]', error); return; }
  FIN.invoices = data || [];
  renderInvoices();
}

async function loadFinancialSettings() {
  const { data } = await APP.db.from('financial_settings').select('*').order('updated_at', { ascending: false }).limit(1);
  FIN.settings = data && data.length > 0 ? data[0] : null;
}

async function loadFinancialDashboard() {
  const { data } = await APP.db.from('financial_dashboard').select('*').single();
  if (!data) return;

  const fmt = (v) => 'R$ ' + (Number(v || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  animCountCurrency('fin-stat-received', Number(data.received_this_month || 0));
  animCountCurrency('fin-stat-pending',  Number(data.total_pending || 0));
  animCountCurrency('fin-stat-overdue',  Number(data.total_overdue || 0));

  // MRR: sum of all recurring invoice averages  
  const mrr = FIN.invoices
    .filter(i => i.is_recurring && i.status !== 'cancelled')
    .reduce((s, i) => s + Number(i.total), 0);
  animCountCurrency('fin-stat-mrr', mrr);

  // Overdue banner
  if (Number(data.count_overdue) > 0) {
    document.getElementById('fin-overdue-banner').style.display = 'flex';
    document.getElementById('fin-overdue-count').textContent = data.count_overdue;
    document.getElementById('fin-overdue-amount').textContent = fmt(data.total_overdue);
  } else {
    document.getElementById('fin-overdue-banner').style.display = 'none';
  }

  // Monthly chart
  renderMonthlyChart();
}

async function renderMonthlyChart() {
  const { data } = await APP.db
    .from('invoices')
    .select('issue_date, total, amount_paid, status')
    .neq('status', 'cancelled')
    .neq('status', 'draft')
    .order('issue_date');

  if (!data || !data.length) return;

  // Group by month
  const months = {};
  data.forEach(inv => {
    const m = inv.issue_date.slice(0, 7); // YYYY-MM
    if (!months[m]) months[m] = { issued: 0, received: 0 };
    months[m].issued   += Number(inv.total);
    months[m].received += Number(inv.amount_paid);
  });

  const keys = Object.keys(months).slice(-6); // last 6 months
  const maxVal = Math.max(...keys.map(k => months[k].issued), 1);

  const chartEl = document.getElementById('fin-bar-chart');
  if (!chartEl) return;

  chartEl.innerHTML = keys.map(m => {
    const pct = Math.round((months[m].issued / maxVal) * 100);
    const rcv = Math.round((months[m].received / maxVal) * 100);
    const label = new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' });
    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:2px">
        <div style="position: relative; height: 70px; width: 100%; display: flex; align-items: flex-end; gap: 2px">
          <div class="mini-bar" title="Emitido: R$ ${months[m].issued.toFixed(2)}"
               style="height: ${pct}%; background: rgba(252, 81, 48, 0.4); flex:1"></div>
          <div class="mini-bar" title="Recebido: R$ ${months[m].received.toFixed(2)}"
               style="height: ${rcv}%; background: var(--brand-green); flex:1; opacity:0.8"></div>
        </div>
        <span class="mini-bar-label">${label}</span>
      </div>
    `;
  }).join('');
}

/* ============================================================
   RENDER INVOICES TABLE
   ============================================================ */
function renderInvoices() {
  const search = (document.getElementById('fin-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('fin-filter-status')?.value || '';
  const clientF = document.getElementById('fin-filter-client')?.value || '';

  let list = FIN.invoices.filter(inv => {
    const matchS = !search || inv.invoice_number?.toLowerCase().includes(search)
      || inv.clients?.name?.toLowerCase().includes(search);
    const matchSt = !statusF || inv.status === statusF;
    const matchCl = !clientF || inv.client_id === clientF;
    return matchS && matchSt && matchCl;
  });

  const tbody = document.getElementById('invoices-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhuma fatura encontrada.</td></tr>';
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);

  tbody.innerHTML = list.map(inv => {
    const due = new Date(inv.due_date);
    const dueClass = inv.status === 'paid' ? 'due-ok' :
      due < today ? 'due-overdue' :
      (due - today) / 864e5 <= 3 ? 'due-soon' : 'due-ok';

    const balance = Number(inv.total) - Number(inv.amount_paid);

    return `
      <tr>
        <td>
          <div style="font-weight:700;font-size:0.82rem;color:var(--text-1)">${escHtml(inv.invoice_number)}</div>
          ${inv.is_recurring ? '<div style="font-size:0.68rem;color:var(--brand-purple)">🔄 Recorrente</div>' : ''}
        </td>
        <td class="td-name">${escHtml(inv.clients?.name || '—')}</td>
        <td>${escHtml(inv.projects?.name || '—')}</td>
        <td><span class="amount-display">R$ ${Number(inv.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span></td>
        <td>
          ${balance > 0 && inv.status !== 'paid'
            ? `<span class="amount-display yellow">R$ ${balance.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`
            : `<span class="amount-display green">Pago ✓</span>`}
        </td>
        <td><span class="${dueClass}">${formatDate(inv.due_date, true)}</span></td>
        <td><span class="badge badge-${inv.status}">${invoiceStatusLabel(inv.status)}</span></td>
        <td>
          <div class="td-actions">
            <button class="btn-icon" title="Editar Fatura" onclick="openInvoiceModal('${inv.id}')">✏️</button>
            <button class="btn-icon" title="Preview PDF" onclick="previewInvoice('${inv.id}')">🖨️</button>
            ${inv.status !== 'paid' && inv.status !== 'cancelled'
              ? `<button class="btn-icon" title="Registrar pagamento" onclick="openPaymentModal('${inv.id}')">💰</button>`
              : ''}
            ${inv.asaas_payment_url ? `<a href="${inv.asaas_payment_url}" target="_blank" class="btn-icon" title="Ver Link do Asaas" style="text-decoration:none">🔗</a>` : ''}
            ${inv.status === 'draft'
              ? `<button class="btn-icon" title="Marcar como enviada" onclick="markInvoiceSent('${inv.id}')">📤</button>`
              : ''}
            <button class="btn-icon" title="WhatsApp" onclick="sendInvoiceWhatsApp('${inv.id}')">💬</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ============================================================
   INVOICE MODAL — CREATE / EDIT
   ============================================================ */
function openInvoiceModal(editId = null) {
  FIN.editingInvoice = editId;
  FIN.items = [];

  // Populate client select in invoice form
  const clientSel = document.getElementById('inv-client');
  clientSel.innerHTML = '<option value="">Selecione o cliente *</option>' +
    APP.data.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  // Populate project select
  const projSel = document.getElementById('inv-project');
  projSel.innerHTML = '<option value="">Projeto (opcional)</option>' +
    APP.data.projects.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

  if (editId) {
    const inv = FIN.invoices.find(i => i.id === editId);
    if (!inv) return;
    document.getElementById('inv-modal-title').textContent = '✏️ Editar Fatura';
    document.getElementById('inv-client').value  = inv.client_id || '';
    document.getElementById('inv-project').value = inv.project_id || '';
    document.getElementById('inv-due').value     = inv.due_date || '';
    document.getElementById('inv-method').value  = inv.payment_method || '';
    document.getElementById('inv-notes').value   = inv.notes || '';
    document.getElementById('inv-recurring').checked = inv.is_recurring || false;
    document.getElementById('inv-recurrence').value  = inv.recurrence || '';
    document.getElementById('inv-discount').value    = inv.discount || 0;
    FIN.items = (inv.invoice_items || []).map(item => ({
      id: item.id, description: item.description,
      quantity: item.quantity, unit_price: item.unit_price,
    }));
  } else {
    document.getElementById('inv-modal-title').textContent = '🧾 Nova Fatura';
    document.getElementById('invoice-modal-form').reset();
    // Default due date
    const due = new Date();
    due.setDate(due.getDate() + (FIN.settings?.default_due_days || 7));
    document.getElementById('inv-due').value = due.toISOString().split('T')[0];
    FIN.items = [{ description: '', quantity: 1, unit_price: 0 }];
  }

  renderInvoiceItems();
  openModal('modal-invoice');
}

function renderInvoiceItems() {
  const tbody = document.getElementById('invoice-items-tbody');
  
  // Create datalist for autocomplete if it doesn't exist
  let datalist = document.getElementById('dl-products');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'dl-products';
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = FIN.products.map(p => `<option value="${escHtml(p.name)}"></option>`).join('');

  tbody.innerHTML = FIN.items.map((item, i) => `
    <tr>
      <td>
        <input class="item-row-input" type="text" value="${escHtml(item.description)}" list="dl-products"
          placeholder="Descrição do serviço..."
          oninput="handleItemDescChange(${i}, this.value)" />
      </td>
      <td style="width:80px">
        <input class="item-row-input" type="number" value="${item.quantity}" min="0.01" step="0.01"
          style="width:70px"
          oninput="FIN.items[${i}].quantity = +this.value; updateItemTotal(${i})" />
      </td>
      <td style="width:120px">
        <input class="item-row-input" type="number" value="${item.unit_price}" min="0" step="0.01"
          style="width:110px"
          oninput="FIN.items[${i}].unit_price = +this.value; updateItemTotal(${i})" />
      </td>
      <td class="item-row-total" id="item-total-${i}">
        R$ ${(item.quantity * item.unit_price).toLocaleString('pt-BR', {minimumFractionDigits:2})}
      </td>
      <td>
        <button class="remove-item-btn" onclick="removeItem(${i})" title="Remover">✕</button>
      </td>
    </tr>
  `).join('');
  updateInvoiceTotals();
}

// Automatically populate price if a product from the datalist is selected
function handleItemDescChange(i, value) {
  FIN.items[i].description = value;
  
  // Find in products
  const product = FIN.products.find(p => p.name === value);
  if (product && FIN.items[i].unit_price === 0) {
    FIN.items[i].unit_price = Number(product.default_price);
    // Re-render completely to update the price input visual
    renderInvoiceItems(); 
  } else {
    updateItemTotal(i);
  }
}

function updateItemTotal(i) {
  const el = document.getElementById(`item-total-${i}`);
  if (el) el.textContent = 'R$ ' + (FIN.items[i].quantity * FIN.items[i].unit_price).toLocaleString('pt-BR', {minimumFractionDigits:2});
  updateInvoiceTotals();
}

function addItem() {
  FIN.items.push({ description: '', quantity: 1, unit_price: 0 });
  renderInvoiceItems();
}

function removeItem(i) {
  if (FIN.items.length === 1) { toast('A fatura precisa ter pelo menos 1 item', 'info'); return; }
  FIN.items.splice(i, 1);
  renderInvoiceItems();
}

function updateInvoiceTotals() {
  const subtotal = FIN.items.reduce((s, item) => s + (item.quantity * item.unit_price), 0);
  const discount = +document.getElementById('inv-discount')?.value || 0;
  const discType = document.getElementById('inv-discount-type')?.value || 'fixed';
  const discAmt  = discType === 'percent' ? subtotal * discount / 100 : discount;
  const total    = Math.max(0, subtotal - discAmt);

  const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const el  = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = fmt(val); };
  el('inv-subtotal-display', subtotal);
  el('inv-discount-display', discAmt);
  el('inv-total-display',    total);
}

async function handleSaveInvoice(e) {
  e.preventDefault();
  const clientId = document.getElementById('inv-client').value;
  if (!clientId) { toast('Selecione um cliente', 'error'); return; }
  if (!FIN.items.some(i => i.description && i.unit_price > 0)) {
    toast('Adicione pelo menos um item com valor', 'error'); return;
  }

  const subtotal = FIN.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = +document.getElementById('inv-discount').value || 0;
  const discType = document.getElementById('inv-discount-type').value || 'fixed';
  const discAmt  = discType === 'percent' ? subtotal * discount / 100 : discount;
  const total    = Math.max(0, subtotal - discAmt);

  const payload = {
    client_id:      clientId,
    project_id:     document.getElementById('inv-project').value || null,
    due_date:       document.getElementById('inv-due').value,
    payment_method: document.getElementById('inv-method').value || null,
    notes:          document.getElementById('inv-notes').value.trim() || null,
    is_recurring:   document.getElementById('inv-recurring').checked,
    recurrence:     document.getElementById('inv-recurrence').value || null,
    subtotal,
    discount,
    discount_type:  discType,
    total,
    invoice_number: '',  // auto-generate via trigger
  };

  // Check if there are valid items; if there's price but no description, block it.
  const invalidItem = FIN.items.find(i => !i.description.trim() && (i.unit_price > 0 || i.quantity > 0));
  if (invalidItem) {
    toast('Preencha a DESCRIÇÃO de todos os itens antes de salvar!', 'error');
    return;
  }

  try {
    const btn = document.getElementById('btn-save-invoice');
    btn.disabled = true; btn.textContent = 'Salvando...';

    let invId = FIN.editingInvoice;

    if (invId) {
      delete payload.invoice_number; // Never overwrite invoice number on update
      
      const { error: updErr } = await APP.db.from('invoices').update(payload).eq('id', invId);
      if (updErr) throw updErr;
      
      // Only delete items if update succeeds
      await APP.db.from('invoice_items').delete().eq('invoice_id', invId);
    } else {
      const { data, error } = await APP.db.from('invoices').insert([payload]).select().single();
      if (error) throw error;
      invId = data.id;
    }

    // Insert items
    const itemsPayload = FIN.items
      .filter(i => i.description && i.unit_price >= 0)
      .map((item, pos) => ({
        invoice_id:  invId,
        description: item.description,
        quantity:    item.quantity,
        unit_price:  item.unit_price,
        position:    pos,
      }));

    if (itemsPayload.length > 0) {
      const { error: itemErr } = await APP.db.from('invoice_items').insert(itemsPayload);
      if (itemErr) throw itemErr;
    }

    // Sync with Asaas if possible
    const existingInv = FIN.editingInvoice ? FIN.invoices.find(i => i.id === FIN.editingInvoice) : null;
    const isSyncableToAsaas = FIN.settings?.asaas_api_key && (!FIN.editingInvoice || (existingInv && !existingInv.asaas_invoice_id));

    if (isSyncableToAsaas) {
      toast('Gerando Link de Pagamento no Asaas...', 'info');
      const { data: resData, error: fnErr } = await APP.db.functions.invoke('asaas', {
        body: { action: 'create_invoice', invoiceId: invId }
      });
      
      if (fnErr) {
        toast('Erro no Asaas: ' + fnErr.message, 'error');
      } else if (resData?.error) {
        toast('Erro no Asaas: ' + resData.error, 'error');
      } else {
        toast('Link do Asaas gerado com sucesso!', 'success');
      }
    } else if (!FIN.settings?.asaas_api_key) {
      toast('Salvo como Rascunho. Asaas API Key não configurada!', 'info');
    }

    toast(FIN.editingInvoice ? 'Fatura atualizada!' : 'Fatura criada!', 'success');
    closeModal('modal-invoice');
    await loadInvoices();
    renderInvoices();
    loadFinancialDashboard();
  } catch (err) {
    console.error('Erro ao salvar fatura:', err);
    toast('Erro: ' + (err.message || 'Falha ao salvar'), 'error');
  } finally {
    const btn = document.getElementById('btn-save-invoice');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar Fatura';
    }
  }
}

/* ============================================================
   INVOICE ACTIONS
   ============================================================ */
async function markInvoiceSent(id) {
  await APP.db.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
  toast('Fatura marcada como enviada!', 'success');
  await loadInvoices();
}

async function markOverdue() {
  const { data } = await APP.db.rpc('mark_overdue_invoices');
  toast(`${data || 0} fatura(s) marcadas como vencidas`, 'info');
  await loadInvoices();
  await loadFinancialDashboard();
}

function sendInvoiceWhatsApp(id) {
  const inv = FIN.invoices.find(i => i.id === id);
  if (!inv) return;
  const whatsapp = inv.clients?.whatsapp?.replace(/\D/g, '') || '';
  const msg = `Olá ${escHtml(inv.clients?.name || '')}! 👋\n\nSegue a fatura *${inv.invoice_number}*:\n\n💰 Valor: R$ ${Number(inv.total).toLocaleString('pt-BR', {minimumFractionDigits:2})}\n📅 Vencimento: ${formatDate(inv.due_date, true)}\n\n${inv.payment_method === 'pix' && FIN.settings?.pix_key ? `🔑 Chave PIX: ${FIN.settings.pix_key}` : ''}\n\nAgência Higher`;
  window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ============================================================
   PAYMENT MODAL
   ============================================================ */
function openPaymentModal(invoiceId) {
  const inv = FIN.invoices.find(i => i.id === invoiceId);
  if (!inv) return;

  const balance = Number(inv.total) - Number(inv.amount_paid);
  document.getElementById('pay-invoice-id').value  = invoiceId;
  document.getElementById('pay-amount').value       = balance.toFixed(2);
  document.getElementById('pay-date').value         = new Date().toISOString().split('T')[0];
  document.getElementById('pay-method').value       = inv.payment_method || '';
  document.getElementById('pay-reference').value    = '';
  document.getElementById('pay-notes').value        = '';
  document.getElementById('pay-invoice-info').textContent =
    `${inv.invoice_number} — ${inv.clients?.name} — Saldo: R$ ${balance.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
  openModal('modal-payment');
}

async function handleSavePayment(e) {
  e.preventDefault();
  const invoiceId = document.getElementById('pay-invoice-id').value;
  const amount    = +document.getElementById('pay-amount').value;
  const paidAt    = document.getElementById('pay-date').value;
  const method    = document.getElementById('pay-method').value;
  const reference = document.getElementById('pay-reference').value.trim();
  const notes     = document.getElementById('pay-notes').value.trim();

  if (!amount || amount <= 0) { toast('Valor inválido', 'error'); return; }

  const btn = document.getElementById('btn-save-payment');
  btn.disabled = true; btn.textContent = 'Registrando...';

  const { error } = await APP.db.from('payments').insert([{
    invoice_id: invoiceId,
    amount,
    paid_at: paidAt,
    method: method || null,
    reference: reference || null,
    notes: notes || null,
  }]);

  btn.disabled = false; btn.textContent = 'Registrar Pagamento';
  if (error) { toast('Erro ao registrar pagamento: ' + error.message, 'error'); return; }
  toast('Pagamento registrado! 💰', 'success');
  closeModal('modal-payment');
  await loadInvoices();
  await loadFinancialDashboard();
}

/* ============================================================
   INVOICE PREVIEW (Print)
   ============================================================ */
function previewInvoice(id) {
  const inv = FIN.invoices.find(i => i.id === id);
  if (!inv) return;
  const s = FIN.settings || {};

  const itemsHtml = (inv.invoice_items || []).map(item => `
    <tr>
      <td>${escHtml(item.description)}</td>
      <td class="text-right">${Number(item.quantity).toLocaleString('pt-BR')}</td>
      <td class="text-right">R$ ${Number(item.unit_price).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      <td class="text-right">R$ ${Number(item.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
    </tr>
  `).join('');

  const discAmt = inv.discount_type === 'percent'
    ? Number(inv.subtotal) * Number(inv.discount) / 100
    : Number(inv.discount);

  const payInfo = s.pix_key
    ? `<strong>PIX:</strong> ${s.pix_key} (${s.pix_type || ''})${s.bank_name ? `<br/><strong>Banco:</strong> ${s.bank_name}` : ''}`
    : 'Consulte seu gestor para informações de pagamento.';

  document.getElementById('invoice-preview-html').innerHTML = `
    <div class="invoice-preview">
      <div class="invoice-preview-header">
        <div class="inv-preview-logo">
          <div class="inv-preview-logo-icon">H</div>
          <span>${escHtml(s.company_name || 'Agência Higher')}</span>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.1rem;font-weight:800">${escHtml(inv.invoice_number)}</div>
          <div class="inv-preview-number">Emissão: ${formatDate(inv.issue_date, true)}</div>
          <div class="inv-preview-number">Vencimento: ${formatDate(inv.due_date, true)}</div>
        </div>
      </div>
      <div class="invoice-preview-body">
        <div class="inv-preview-parties">
          <div>
            <div class="inv-party-label">De</div>
            <div class="inv-party-name">${escHtml(s.company_name || 'Agência Higher')}</div>
            <div class="inv-party-info">${s.cnpj ? 'CNPJ: ' + escHtml(s.cnpj) + '<br/>' : ''}${s.email ? escHtml(s.email) + '<br/>' : ''}${s.phone ? escHtml(s.phone) : ''}</div>
          </div>
          <div>
            <div class="inv-party-label">Para</div>
            <div class="inv-party-name">${escHtml(inv.clients?.name || '—')}</div>
            <div class="inv-party-info">${inv.clients?.email ? escHtml(inv.clients.email) + '<br/>' : ''}${inv.clients?.whatsapp ? escHtml(inv.clients.whatsapp) : ''}</div>
          </div>
        </div>
        <table class="inv-preview-table">
          <thead><tr>
            <th>Descrição</th>
            <th class="text-right" style="width:80px">Qtd</th>
            <th class="text-right" style="width:130px">Preço Unit.</th>
            <th class="text-right" style="width:130px">Total</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="inv-preview-total-section">
          <div class="inv-preview-totals">
            <div class="inv-preview-total-row">
              <span>Subtotal</span>
              <span>R$ ${Number(inv.subtotal).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>
            ${discAmt > 0 ? `<div class="inv-preview-total-row">
              <span>Desconto</span>
              <span>- R$ ${discAmt.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>` : ''}
            <div class="inv-preview-total-row grand">
              <span>TOTAL</span>
              <span>R$ ${Number(inv.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>
            ${Number(inv.amount_paid) > 0 ? `<div class="inv-preview-total-row" style="color:#22C55E;font-size:.8rem">
              <span>Pago</span>
              <span>R$ ${Number(inv.amount_paid).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>` : ''}
          </div>
        </div>
        <div class="inv-preview-payment">
          <div class="inv-preview-payment-title">Dados para Pagamento</div>
          <div style="font-size:.83rem;color:#555;line-height:1.8">${payInfo}</div>
        </div>
        ${inv.client_notes ? `<div class="inv-preview-notes"><strong>Observações:</strong> ${escHtml(inv.client_notes)}</div>` : ''}
      </div>
      <div class="inv-preview-footer">${escHtml(s.company_name || 'Agência Higher')} · Obrigado pela confiança!</div>
    </div>
    <div class="no-print" style="display:flex;gap:.75rem;margin-top:1rem;justify-content:flex-end">
      <button class="btn-ghost" onclick="closeModal('modal-invoice-preview')">Fechar</button>
      <button class="btn-primary" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    </div>
  `;
  openModal('modal-invoice-preview');
}

async function openInvoiceDetail(id) {
  const inv = FIN.invoices.find(i => i.id === id);
  if (!inv) return;

  // Load payments for this invoice
  const { data: pmts } = await APP.db
    .from('payments')
    .select('*')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: false });

  const balance = Number(inv.total) - Number(inv.amount_paid);
  const pmtHtml = pmts?.length ? pmts.map(p => `
    <div class="payment-history-item">
      <div>
        <div class="payment-history-amount">R$ ${Number(p.amount).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
        <div class="payment-history-meta">${formatDate(p.paid_at, true)} · ${methodLabel(p.method)} ${p.reference ? '· ' + escHtml(p.reference) : ''}</div>
      </div>
    </div>
  `).join('') : '<div style="color:var(--text-3);font-size:.82rem">Nenhum pagamento registrado.</div>';

  document.getElementById('modal-invoice-detail-body').innerHTML = `
    <div class="invoice-detail-header">
      <div>
        <div class="invoice-detail-number">${escHtml(inv.invoice_number)}</div>
        <div class="invoice-detail-meta">
          <span style="color:var(--text-3);font-size:.82rem">Cliente: <strong style="color:var(--text-1)">${escHtml(inv.clients?.name || '—')}</strong></span>
          ${inv.projects?.name ? `<span style="color:var(--text-3);font-size:.82rem">Projeto: <strong style="color:var(--text-1)">${escHtml(inv.projects.name)}</strong></span>` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <span class="badge badge-${inv.status}">${invoiceStatusLabel(inv.status)}</span>
        <div style="font-size:1.4rem;font-weight:900;font-family: Outfit;margin-top:.5rem">
          R$ ${Number(inv.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
        ${balance > 0 ? `<div style="font-size:.8rem;color:#fbbf24">Saldo: R$ ${balance.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>` : ''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem;font-size:.82rem">
      <div><span style="color:var(--text-3)">Emissão:</span> ${formatDate(inv.issue_date, true)}</div>
      <div><span style="color:var(--text-3)">Vencimento:</span> <strong class="${new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? 'due-overdue' : ''}">${formatDate(inv.due_date, true)}</strong></div>
      ${inv.payment_method ? `<div><span style="color:var(--text-3)">Método:</span> ${methodLabel(inv.payment_method)}</div>` : ''}
      ${inv.is_recurring ? `<div><span style="color:var(--text-3)">Recorrência:</span> ${recurrenceLabel(inv.recurrence)}</div>` : ''}
    </div>
    <table class="invoice-items-table" style="margin-bottom:1rem">
      <thead><tr><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead>
      <tbody>
        ${(inv.invoice_items || []).map(item => `
          <tr>
            <td>${escHtml(item.description)}</td>
            <td>${Number(item.quantity).toLocaleString('pt-BR')}</td>
            <td>R$ ${Number(item.unit_price).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td style="font-weight:700">R$ ${Number(item.total).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="payment-section">
      <h4>💳 Histórico de Pagamentos</h4>
      ${pmtHtml}
    </div>
    <div style="display:flex;gap:.75rem;margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid var(--border);flex-wrap:wrap">
      ${inv.status !== 'paid' && inv.status !== 'cancelled'
        ? `<button class="btn-primary" onclick="closeModal('modal-invoice-detail');openPaymentModal('${inv.id}')">💰 Registrar Pagamento</button>` : ''}
      <button class="btn-ghost" onclick="closeModal('modal-invoice-detail');previewInvoice('${inv.id}')">🖨️ Preview</button>
      <button class="btn-ghost" onclick="sendInvoiceWhatsApp('${inv.id}')">💬 WhatsApp</button>
      <button class="btn-ghost" onclick="closeModal('modal-invoice-detail');openInvoiceModal('${inv.id}')">✏️ Editar</button>
      ${inv.status !== 'cancelled'
        ? `<button class="btn-ghost" style="color:#f87171" onclick="cancelInvoice('${inv.id}')">❌ Cancelar</button>` : ''}
    </div>
  `;
  openModal('modal-invoice-detail');
}

async function cancelInvoice(id) {
  if (!confirm('Cancelar esta fatura?')) return;
  await APP.db.from('invoices').update({ status: 'cancelled' }).eq('id', id);
  toast('Fatura cancelada', 'info');
  closeModal('modal-invoice-detail');
  await loadInvoices();
  await loadFinancialDashboard();
}

/* ============================================================
   FINANCIAL SETTINGS
   ============================================================ */
// Load Asaas Config
function openFinancialSettings() {
  const s = FIN.settings || {};
  document.getElementById('fs-company').value    = s.company_name || '';
  document.getElementById('fs-cnpj').value       = s.cnpj || '';
  document.getElementById('fs-email').value      = s.email || '';
  document.getElementById('fs-phone').value      = s.phone || '';
  document.getElementById('fs-pix-key').value    = s.pix_key || '';
  document.getElementById('fs-pix-type').value   = s.pix_type || '';
  document.getElementById('fs-bank').value       = s.bank_name || '';
  document.getElementById('fs-agency').value     = s.bank_agency || '';
  document.getElementById('fs-account').value    = s.bank_account || '';
  document.getElementById('fs-due-days').value   = s.default_due_days || 7;
  document.getElementById('fs-prefix').value     = s.invoice_prefix || 'HIGHER';
  
  if (document.getElementById('fs-asaas-api')) document.getElementById('fs-asaas-api').value = s.asaas_api_key || '';
  if (document.getElementById('fs-asaas-wallet')) document.getElementById('fs-asaas-wallet').value = s.asaas_wallet_id || '';
  if (document.getElementById('fs-asaas-webhook')) document.getElementById('fs-asaas-webhook').value = s.asaas_webhook_token || '';
  
  openModal('modal-fin-settings');
}

async function handleSaveFinSettings(e) {
  try {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
  } catch(e) {}
  
  console.log("--> [START] handleSaveFinSettings INICIADO!");
  const btn = document.getElementById('btn-save-fin-settings');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processando...';
  }

  try {
    console.log("--> Montando payload...");
    const payload = {
      company_name:       (document.getElementById('fs-company')?.value || '').trim(),
      cnpj:               (document.getElementById('fs-cnpj')?.value || '').trim() || null,
      email:              (document.getElementById('fs-email')?.value || '').trim() || null,
      phone:              (document.getElementById('fs-phone')?.value || '').trim() || null,
      pix_key:            (document.getElementById('fs-pix-key')?.value || '').trim() || null,
      pix_type:           document.getElementById('fs-pix-type')?.value || null,
      bank_name:          (document.getElementById('fs-bank')?.value || '').trim() || null,
      bank_agency:        (document.getElementById('fs-agency')?.value || '').trim() || null,
      bank_account:       (document.getElementById('fs-account')?.value || '').trim() || null,
      default_due_days:   +(document.getElementById('fs-due-days')?.value) || 7,
      invoice_prefix:     (document.getElementById('fs-prefix')?.value || '').trim() || 'HIGHER',
    };
    
    if (document.getElementById('fs-asaas-api')) payload.asaas_api_key = document.getElementById('fs-asaas-api').value.trim() || null;
    if (document.getElementById('fs-asaas-wallet')) payload.asaas_wallet_id = document.getElementById('fs-asaas-wallet').value.trim() || null;
    if (document.getElementById('fs-asaas-webhook')) payload.asaas_webhook_token = document.getElementById('fs-asaas-webhook').value.trim() || null;

    console.log("--> Payload montado: ", payload);

    // Garantir que estamos atualizando a linha correta ou a primeira existente
    let targetId = FIN.settings?.id;
    if (!targetId) {
      const { data: existing } = await APP.db.from('financial_settings').select('id').limit(1);
      if (existing && existing.length > 0) targetId = existing[0].id;
    }

    console.log("--> ID de destino: ", targetId);

    const { error: errorObj } = await APP.db.from('financial_settings').upsert({ 
      ...(targetId ? { id: targetId } : {}),
      ...payload 
    });

    console.log("--> Resposta do BD (error): ", errorObj);
    if (errorObj) throw errorObj;

    toast('Configurações financeiras salvas!', 'success');
    closeModal('modal-fin-settings');
    await loadFinancialSettings();
    console.log("--> [END] Sucesso!");
  } catch (err) {
    console.error("--> [ERROR] Erro ao salvar configs:", err);
    alert("ERRO: " + (err.message || 'Falha desconhecida. Veja o console.'));
    toast('Erro: ' + (err.message || 'Falha ao salvar'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar Configurações';
    }
    console.log("--> [FINALLY] Botão restaurado!");
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
function invoiceStatusLabel(s) {
  return {
    draft: '📝 Rascunho', sent: '📤 Enviada', partial: '⚡ Parcial',
    paid: '✅ Pago', overdue: '🔴 Vencida', cancelled: '❌ Cancelada'
  }[s] || s;
}

function methodLabel(m) {
  return { pix: '⚡ PIX', boleto: '📄 Boleto', transferencia: '🏦 Transferência',
           cartao: '💳 Cartão', dinheiro: '💵 Dinheiro', outro: 'Outro' }[m] || m || '—';
}

function recurrenceLabel(r) {
  return { monthly: 'Mensal 🔄', quarterly: 'Trimestral', yearly: 'Anual' }[r] || r || '—';
}

function animCountCurrency(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  const duration = 1200;
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const val = eased * target;
    el.textContent = 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function populateFinClientFilter() {
  const sel = document.getElementById('fin-filter-client');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos os clientes</option>' +
    APP.data.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
}

/* ============================================================
   PRODUCT MANAGEMENT
   ============================================================ */
function openProductsModal() {
  renderProductList();
  openModal('modal-products');
}

function renderProductList() {
  const tbody = document.getElementById('products-list-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = FIN.products.map(p => `
    <tr>
      <td>${escHtml(p.name)}</td>
      <td>R$ ${Number(p.default_price || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
      <td style="text-align:right">
        <button class="btn-icon" onclick="editProduct('${p.id}')">✏️</button>
        <button class="btn-icon" onclick="deleteProduct('${p.id}')" style="color:#ef4444">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function editProduct(id) {
  const p = FIN.products.find(prod => prod.id === id);
  if (!p) return;
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-price').value = p.default_price;
}

function resetProductForm() {
  document.getElementById('prod-id').value = '';
  document.getElementById('product-form').reset();
}

async function handleSaveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const name = document.getElementById('prod-name').value;
  const price = document.getElementById('prod-price').value;
  const btn = document.getElementById('btn-save-product');

  try {
    btn.disabled = true;
    const payload = { name, default_price: Number(price), is_active: true };
    
    const { error } = await APP.db.from('products').upsert({
      ...(id ? { id } : {}),
      ...payload
    });

    if (error) throw error;

    toast('Produto salvo!', 'success');
    resetProductForm();
    await loadProducts();
    renderProductList();
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteProduct(id) {
  if (!confirm('Deseja remover este produto?')) return;
  try {
    const { error } = await APP.db.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    toast('Produto removido', 'success');
    await loadProducts();
    renderProductList();
  } catch (err) {
    toast('Erro ao remover: ' + err.message, 'error');
  }
}

// Global expose
window.openProductsModal = openProductsModal;
window.resetProductForm   = resetProductForm;
window.editProduct       = editProduct;
window.deleteProduct     = deleteProduct;

// Wait for load to attach event
document.addEventListener('DOMContentLoaded', () => {
  const invForm = document.getElementById('invoice-modal-form');
  if (invForm) invForm.addEventListener('submit', handleSaveInvoice);

  const payForm = document.getElementById('payment-form');
  if (payForm) payForm.addEventListener('submit', handleSavePayment);

  const setForm = document.getElementById('fin-settings-form');
  if (setForm) setForm.addEventListener('submit', handleSaveFinSettings);

  const prodForm = document.getElementById('product-form');
  if (prodForm) prodForm.addEventListener('submit', handleSaveProduct);
});
