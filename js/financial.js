/**
 * HIGHER CRM — FINANCIAL MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';
import { ASAAS } from './asaas.js';

export const FINANCIAL = {
  invoices:  [],
  settings:  null,
  products:  [],
  editingInvoice: null,
  items: [],

  async load() {
    this.showSkeletons();
    await Promise.all([
      this.loadInvoices(),
      this.loadFinancialSettings(),
      this.loadProducts(),
    ]);
    this.loadDashboard();
  },

  showSkeletons() {
    const tbody = document.getElementById('invoices-tbody');
    if (tbody) tbody.innerHTML = Array(5).fill(0).map(() => `<tr><td colspan="8"><div class="skeleton skeleton-row"></div></td></tr>`).join('');
    
    const stats = ['fin-stat-received', 'fin-stat-pending', 'fin-stat-overdue', 'fin-stat-mrr'];
    stats.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div class="skeleton" style="width:100px; height:24px; display:inline-block"></div>';
    });
  },

  async loadProducts() {
    try {
      const { data } = await APP.db.from('products').select('*').order('name');
      this.products = data || [];
      this.renderProducts();
    } catch (e) {
      console.warn('[FIN] Erro ao carregar produtos:', e.message);
    }
  },

  async loadInvoices() {
    try {
      const { data, error } = await APP.db
        .from('invoices')
        .select('*, clients(name, email, whatsapp), projects(name), invoice_items(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.invoices = data || [];
      this.renderInvoices();
    } catch (e) {
      console.error('[FIN] Invoices Error:', e);
    }
  },

  async loadFinancialSettings() {
    try {
      const { data } = await APP.db.from('financial_settings').select('*').limit(1);
      this.settings = data && data.length > 0 ? data[0] : null;
    } catch (e) {
      console.warn('[FIN] Erro ao carregar configurações financeiras');
    }
  },

  async loadDashboard() {
    const today = new Date().toISOString();
    
    // Stats calculation based on loaded invoices
    const received = this.invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total || 0), 0);
    const pending = this.invoices.filter(i => i.status === 'sent' || i.status === 'partial').reduce((sum, i) => sum + Number(i.total || 0) - Number(i.amount_paid || 0), 0);
    const overdueList = this.invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && new Date(i.due_date) < new Date());
    const overdue = overdueList.reduce((sum, i) => sum + Number(i.total || 0) - Number(i.amount_paid || 0), 0);

    UTILS.animCountCurrency('fin-stat-received', received);
    UTILS.animCountCurrency('fin-stat-pending',  pending);
    UTILS.animCountCurrency('fin-stat-overdue',  overdue);

    const mrr = this.calculateMRR();
    UTILS.animCountCurrency('fin-stat-mrr', mrr);

    const banner = document.getElementById('fin-overdue-banner');
    if (overdueList.length > 0 && banner) {
      banner.style.display = 'flex';
      document.getElementById('fin-overdue-count').textContent = overdueList.length;
      document.getElementById('fin-overdue-amount').textContent = UTILS.formatCurrency(overdue);
    } else if (banner) {
      banner.style.display = 'none';
    }
  },

  renderInvoices() {
    const search = document.getElementById('fin-search')?.value.toLowerCase() || '';
    const statusF = document.getElementById('fin-filter-status')?.value || '';
    const clientF = document.getElementById('fin-filter-client')?.value || '';

    let list = this.invoices.filter(inv => {
      const matchS = !search || inv.invoice_number?.toLowerCase().includes(search) || inv.clients?.name?.toLowerCase().includes(search);
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
      const isOverdue = inv.status !== 'paid' && inv.status !== 'cancelled' && due < today;
      const dueClass = inv.status === 'paid' ? 'due-ok' : isOverdue ? 'due-overdue' : 'due-ok';
      
      return `
        <tr>
          <td>
            <div style="font-weight:700;font-size:0.85rem;color:var(--text-1)">${UTILS.escHtml(inv.invoice_number || 'RASCUNHO')}</div>
            ${inv.is_recurring ? '<div style="font-size:0.65rem;color:var(--brand-orange);font-weight:600">🔄 RECORRENTE</div>' : ''}
          </td>
          <td class="td-name">${UTILS.escHtml(inv.clients?.name || '—')}</td>
          <td><span style="font-size:0.8rem">${UTILS.formatCurrency(inv.total)}</span></td>
          <td><span class="${dueClass}">${UTILS.formatDate(inv.due_date, true)}</span></td>
          <td><span class="badge badge-${inv.status}">${UTILS.statusLabel(inv.status)}</span></td>
          <td>
            <div class="td-actions">
              <button class="btn-icon" title="Editar" onclick="openInvoiceModal('${inv.id}')">✏️</button>
              ${inv.asaas_payment_url ? `<a href="${inv.asaas_payment_url}" target="_blank" class="btn-icon" title="Link Asaas">🔗</a>` : ''}
              <button class="btn-icon" title="WhatsApp" onclick="sendInvoiceWhatsApp('${inv.id}')">💬</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openInvoiceModal(editId = null) {
    this.editingInvoice = editId;
    this.items = [];

    const clientSel = document.getElementById('inv-client');
    if (clientSel) {
      clientSel.innerHTML = '<option value="">Selecione o cliente *</option>' +
        APP.data.clients.map(c => `<option value="${c.id}">${UTILS.escHtml(c.name)}</option>`).join('');
    }

    const projSel = document.getElementById('inv-project');
    if (projSel) {
      projSel.innerHTML = '<option value="">Projeto (opcional)</option>' +
        APP.data.projects.map(p => `<option value="${p.id}">${UTILS.escHtml(p.name)}</option>`).join('');
      
      // Adicionar listener para auto-preenchimento
      projSel.onchange = (e) => this.handleProjectChange(e.target.value);
    }

    if (editId) {
      const inv = this.invoices.find(i => i.id === editId);
      if (!inv) return;
      document.getElementById('inv-modal-title').textContent = '✏️ Editar Fatura';
      document.getElementById('inv-client').value  = inv.client_id || '';
      document.getElementById('inv-project').value = inv.project_id || '';
      document.getElementById('inv-due').value     = inv.due_date || '';
      document.getElementById('inv-method').value  = inv.payment_method || 'boleto';
      document.getElementById('inv-notes').value   = inv.notes || '';
      document.getElementById('inv-recurring').checked = inv.is_recurring || false;
      document.getElementById('inv-recurrence').value  = inv.recurrence || 'monthly';
      document.getElementById('inv-discount').value    = inv.discount || 0;
      this.items = (inv.invoice_items || []).map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));
    } else {
      document.getElementById('inv-modal-title').textContent = '🧾 Nova Fatura';
      document.getElementById('invoice-modal-form').reset();
      const due = new Date();
      due.setDate(due.getDate() + (this.settings?.default_due_days || 7));
      document.getElementById('inv-due').value = due.toISOString().split('T')[0];
      this.items = [{ description: '', quantity: 1, unit_price: 0 }];
    }

    this.renderInvoiceItems();
    UTILS.openModal('modal-invoice');
  },

  async handleProjectChange(projectId) {
    if (!projectId) return;

    try {
      // Buscar projeto com os itens do orçamento vinculado
      const { data: project, error } = await APP.db
        .from('projects')
        .select('*, budgets(items)')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      if (project && project.budgets && project.budgets.items) {
        this.items = project.budgets.items.map(it => ({
          description: it.description,
          quantity: it.quantity || 1,
          unit_price: it.unit_price || 0
        }));
        
        // Atualizar cliente se estiver vazio
        const clientSel = document.getElementById('inv-client');
        if (clientSel && !clientSel.value) {
          clientSel.value = project.client_id;
        }

        this.renderInvoiceItems();
        UTILS.toast('Itens do projeto importados com sucesso! 💎', 'success');
      }
    } catch (e) {
      console.warn('[FIN] Erro ao importar dados do projeto:', e.message);
    }
  },

  renderInvoiceItems() {
    const tbody = document.getElementById('invoice-items-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = this.items.map((item, i) => `
      <tr>
        <td>
          <input class="item-row-input" type="text" value="${UTILS.escHtml(item.description)}" 
            placeholder="Descrição do serviço..."
            oninput="handleItemDescChange(${i}, this.value)" />
        </td>
        <td style="width:70px">
          <input class="item-row-input" type="number" value="${item.quantity}" min="1"
            oninput="handleItemQuantityChange(${i}, this.value)" />
        </td>
        <td style="width:110px">
          <input class="item-row-input" type="number" value="${item.unit_price}" min="0" step="0.01"
            oninput="handleItemPriceChange(${i}, this.value)" />
        </td>
        <td style="width:100px; text-align:right; font-size:0.8rem">
          ${UTILS.formatCurrency(item.quantity * item.unit_price)}
        </td>
        <td style="width:40px">
          <button type="button" class="btn-icon" onclick="removeItem(${i})" style="color:var(--brand-red); border:none; background:none">✕</button>
        </td>
      </tr>
    `).join('');
    this.updateInvoiceTotals();
  },

  updateInvoiceTotals() {
    const subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const discount = Number(document.getElementById('inv-discount')?.value || 0);
    const total = Math.max(0, subtotal - discount);

    const totalEl = document.getElementById('inv-total-display');
    if (totalEl) totalEl.textContent = UTILS.formatCurrency(total);
  },

  async saveInvoice(e) {
    e.preventDefault();
    const clientId = document.getElementById('inv-client').value;
    if (!clientId) { UTILS.toast('Selecione um cliente', 'error'); return; }

    const payload = {
      client_id: clientId,
      project_id: document.getElementById('inv-project').value || null,
      due_date: document.getElementById('inv-due').value,
      payment_method: document.getElementById('inv-method').value,
      notes: document.getElementById('inv-notes').value,
      is_recurring: document.getElementById('inv-recurring').checked,
      recurrence: document.getElementById('inv-recurrence').value || 'monthly',
      discount: Number(document.getElementById('inv-discount').value || 0),
      total: this.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) - Number(document.getElementById('inv-discount').value || 0),
      status: this.editingInvoice ? undefined : 'sent'
    };

    try {
      let invId = this.editingInvoice;
      if (invId) {
        await APP.db.from('invoices').update(payload).eq('id', invId);
        await APP.db.from('invoice_items').delete().eq('invoice_id', invId);
      } else {
        const { data, error } = await APP.db.from('invoices').insert([payload]).select().single();
        if (error) throw error;
        invId = data.id;
      }

      const items = this.items.map(it => ({ invoice_id: invId, ...it }));
      await APP.db.from('invoice_items').insert(items);

      // NOVO: Integração Asaas Automática
      const autoBilling = confirm('Deseja gerar a cobrança real no Asaas agora?');
      if (autoBilling) {
        UTILS.toast('Comunicando com Asaas...', 'info');
        const { data: client } = await APP.db.from('clients').select('*').eq('id', clientId).single();
        const { data: invoice } = await APP.db.from('invoices').select('*').eq('id', invId).single();
        
        try {
          await ASAAS.createPayment(invoice, client);
          UTILS.toast('Cobrança Asaas gerada com sucesso! 💎', 'success');
        } catch (err) {
          UTILS.toast('Erro Asaas: ' + err.message, 'error');
        }
      }

      UTILS.toast('Fatura salva!', 'success');
      UTILS.closeModal('modal-invoice');
      this.load();
    } catch (err) {
      UTILS.toast('Erro ao salvar fatura: ' + err.message, 'error');
    }
  },

  async openFinancialSettings() {
    if (!this.settings) await this.loadFinancialSettings();
    
    UTILS.openModal('modal-fin-settings');
    
    if (this.settings) {
      document.getElementById('fs-company').value = this.settings.company_name || '';
      document.getElementById('fs-cnpj').value = this.settings.cnpj || '';
      document.getElementById('fs-email').value = this.settings.email || '';
      document.getElementById('fs-phone').value = this.settings.phone || '';
      document.getElementById('fs-asaas-api').value = this.settings.asaas_api_key || '';
      document.getElementById('fs-due-days').value = this.settings.default_due_days || 7;
      document.getElementById('fs-pix-key').value = this.settings.pix_key || '';
    }
  },

  async saveFinancialSettings(e) {
    e.preventDefault();
    const data = {
      company_name: document.getElementById('fs-company').value,
      cnpj: document.getElementById('fs-cnpj').value,
      email: document.getElementById('fs-email').value,
      phone: document.getElementById('fs-phone').value,
      asaas_api_key: document.getElementById('fs-asaas-api').value,
      default_due_days: Number(document.getElementById('fs-due-days').value),
      pix_key: document.getElementById('fs-pix-key').value,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await APP.db.from('financial_settings').upsert([data]);
      if (error) throw error;
      UTILS.toast('Configurações salvas!', 'success');
      this.settings = data;
      UTILS.closeModal('modal-fin-settings');
    } catch (err) {
      UTILS.toast('Erro ao salvar: ' + err.message, 'error');
    }
  },

  async openProductsModal() {
    await this.loadProducts();
    UTILS.openModal('modal-products');
  },

  renderProducts() {
    const tbody = document.getElementById('products-list-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = this.products.map(p => `
      <tr>
        <td style="font-weight:600">${UTILS.escHtml(p.name)}</td>
        <td>${UTILS.formatCurrency(p.default_price)}</td>
        <td style="text-align:right">
          <button class="btn-icon" onclick="editProduct('${p.id}')">✏️</button>
          <button class="btn-icon" onclick="deleteProduct('${p.id}')" style="color:var(--brand-red)">🗑️</button>
        </td>
      </tr>
    `).join('');
  },

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const payload = {
      name: document.getElementById('prod-name').value,
      default_price: Number(document.getElementById('prod-price').value),
      is_active: true
    };

    try {
      if (id) await APP.db.from('products').update(payload).eq('id', id);
      else await APP.db.from('products').insert([payload]);
      
      UTILS.toast('Produto salvo!', 'success');
      document.getElementById('product-form').reset();
      document.getElementById('prod-id').value = '';
      await this.loadProducts();
    } catch (err) {
      UTILS.toast('Erro ao salvar produto', 'error');
    }
  },

  calculateMRR() {
    return this.invoices
      .filter(i => i.is_recurring && i.status !== 'cancelled')
      .reduce((total, inv) => total + Number(inv.total || 0), 0);
  }
};

// Global Exposure
window.openInvoiceModal = (id) => FINANCIAL.openInvoiceModal(id);
window.handleSaveInvoice = (e) => FINANCIAL.saveInvoice(e);
window.openFinancialSettings = () => FINANCIAL.openFinancialSettings();
window.handleSaveFinancialSettings = (e) => FINANCIAL.saveFinancialSettings(e);
window.openProductsModal = () => FINANCIAL.openProductsModal();
window.handleSaveProduct = (e) => FINANCIAL.saveProduct(e);
window.addItem = () => { FINANCIAL.items.push({ description: '', quantity: 1, unit_price: 0 }); FINANCIAL.renderInvoiceItems(); };
window.removeItem = (i) => { FINANCIAL.items.splice(i, 1); FINANCIAL.renderInvoiceItems(); };
window.handleItemDescChange = (i, v) => { FINANCIAL.items[i].description = v; };
window.handleItemQuantityChange = (i, v) => { FINANCIAL.items[i].quantity = Number(v); FINANCIAL.updateInvoiceTotals(); };
window.handleItemPriceChange = (i, v) => { FINANCIAL.items[i].unit_price = Number(v); FINANCIAL.updateInvoiceTotals(); };
window.editProduct = (id) => {
  const p = FINANCIAL.products.find(prod => prod.id === id);
  if (p) {
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-price').value = p.default_price;
  }
};
window.deleteProduct = async (id) => {
  if (confirm('Deseja excluir este produto?')) {
    await APP.db.from('products').delete().eq('id', id);
    FINANCIAL.loadProducts();
  }
};
window.resetProductForm = () => {
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
};
window.openWebhookLogsModal = () => { UTILS.toast('Logs em desenvolvimento', 'info'); };
window.sendInvoiceWhatsApp = (id) => { UTILS.toast('Enviando via WhatsApp...', 'info'); };
