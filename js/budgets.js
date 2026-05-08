/**
 * HIGHER CRM — BUDGETS MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const BUDGETS = {
  items: [], // Temp items for the current modal

  async load() {
    const search = document.getElementById('budgets-search')?.value || '';
    const status = document.getElementById('budget-filter-status')?.value || '';

    let query = APP.db
      .from('budgets')
      .select('*, clients(name)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;

    if (error) {
      console.error('[Budgets] Error loading:', error);
      return;
    }

    this.render(data);
  },

  render(data) {
    const tbody = document.getElementById('budgets-tbody');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted)">Nenhum orçamento encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(b => `
      <tr>
        <td>#${b.id.toString().slice(-4).toUpperCase()}</td>
        <td><strong>${b.clients?.name || 'Cliente removido'}</strong></td>
        <td>${b.title}</td>
        <td>${UTILS.formatCurrency(b.total_amount)}</td>
        <td>${UTILS.formatDate(b.valid_until)}</td>
        <td><span class="status-badge badge-${b.status}">${this.getStatusLabel(b.status)}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" onclick="openBudgetModal('${b.id}')" title="Editar">✏️</button>
            <button class="btn-icon" onclick="printBudget('${b.id}')" title="Imprimir/PDF">🖨️</button>
            <button class="btn-icon" onclick="copyBudgetLink('${b.id}')" title="Copiar Link">🔗</button>
            ${b.status === 'approved' ? `<button class="btn-icon" onclick="convertBudgetToProject('${b.id}')" title="Gerar Projeto">🚀</button>` : ''}
            <button class="btn-icon" onclick="deleteBudget('${b.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  getStatusLabel(status) {
    const labels = {
      draft: 'Rascunho',
      sent: 'Enviado',
      approved: 'Aprovado',
      declined: 'Recusado'
    };
    return labels[status] || status;
  },

  async openModal(prefill = null, id = null) {
    const modal = document.getElementById('modal-budget');
    const form = document.getElementById('budget-form');
    const titleEl = document.getElementById('budget-modal-title');
    
    form.reset();
    document.getElementById('budget-id').value = id || '';
    this.items = [];
    this.renderItems();
    this.calculateTotal();

    // Fill clients dropdown
    const clientSelect = document.getElementById('bf-client');
    const { data: clients } = await APP.db.from('clients').select('id, name').order('name');
    clientSelect.innerHTML = '<option value="">Selecione um cliente...</option>' + 
      clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if (id) {
      titleEl.textContent = 'Editar Orçamento';
      const { data: budget } = await APP.db.from('budgets').select('*').eq('id', id).single();
      if (budget) {
        document.getElementById('bf-client').value = budget.client_id;
        document.getElementById('bf-title').value = budget.title;
        document.getElementById('bf-valid-until').value = budget.valid_until;
        document.getElementById('bf-status').value = budget.status;
        document.getElementById('bf-notes').value = budget.notes || '';
        document.getElementById('bf-discount').value = budget.discount_percent || 0;
        
        this.items = budget.items || [];
        this.renderItems();
        this.calculateTotal();
      }
    } else {
      titleEl.textContent = 'Novo Orçamento';
      // Default validity: +15 days
      const date = new Date();
      date.setDate(date.getDate() + 15);
      document.getElementById('bf-valid-until').value = date.toISOString().split('T')[0];

      // NOVO: Aplicar preenchimento do Lead
      if (prefill) {
        if (prefill.client_id) document.getElementById('bf-client').value = prefill.client_id;
        if (prefill.title) document.getElementById('bf-title').value = prefill.title;
        if (prefill.notes) document.getElementById('bf-notes').value = prefill.notes;
      }
    }

    // Fill products datalist
    const { data: products } = await APP.db.from('products').select('name, default_price').order('name');
    const datalist = document.getElementById('products-datalist');
    if (datalist && products) {
      datalist.innerHTML = products.map(p => `<option value="${p.name}" data-price="${p.default_price}">`).join('');
    }

    UTILS.openModal('modal-budget');
  },

  handleProductSelect(index, name) {
    const datalist = document.getElementById('products-datalist');
    const option = Array.from(datalist.options).find(opt => opt.value === name);
    if (option) {
      const price = parseFloat(option.dataset.price) || 0;
      this.updateItem(index, 'description', name);
      this.updateItem(index, 'unit_price', price);
      this.renderItems();
    } else {
      this.updateItem(index, 'description', name);
    }
  },

  addItem() {
    this.items.push({ description: '', quantity: 1, unit_price: 0 });
    this.renderItems();
  },

  removeItem(index) {
    this.items.splice(index, 1);
    this.renderItems();
    this.calculateTotal();
  },

  updateItem(index, field, value) {
    if (field === 'quantity') value = parseInt(value) || 0;
    if (field === 'unit_price') value = parseFloat(value) || 0;
    this.items[index][field] = value;
    this.renderItems(false); // Don't re-render everything to avoid losing focus
    this.calculateTotal();
  },

  renderItems(fullRender = true) {
    const tbody = document.getElementById('budget-items-tbody');
    if (!tbody) return;

    if (fullRender) {
      tbody.innerHTML = this.items.map((item, index) => `
        <tr>
          <td>
            <input type="text" class="table-input" list="products-datalist" value="${item.description}" 
              placeholder="Descrição do serviço" 
              oninput="handleBudgetProductSelect(${index}, this.value)" />
          </td>
          <td><input type="number" class="table-input" value="${item.quantity}" min="1" onchange="updateBudgetItem(${index}, 'quantity', this.value)" /></td>
          <td><input type="number" class="table-input" value="${item.unit_price}" step="0.01" onchange="updateBudgetItem(${index}, 'unit_price', this.value)" /></td>
          <td><strong>${UTILS.formatCurrency(item.quantity * item.unit_price)}</strong></td>
          <td><button type="button" class="btn-icon" onclick="removeBudgetItem(${index})">❌</button></td>
        </tr>
      `).join('');

      if (this.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-muted)">Nenhum item adicionado.</td></tr>';
      }
    } else {
      // Update only the total column for each row
      const rows = tbody.querySelectorAll('tr');
      this.items.forEach((item, index) => {
        if (rows[index]) {
          const totalCol = rows[index].querySelector('td:nth-child(4) strong');
          if (totalCol) totalCol.textContent = UTILS.formatCurrency(item.quantity * item.unit_price);
        }
      });
    }
  },

  calculateTotal() {
    const subtotal = this.items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const discountPercent = parseFloat(document.getElementById('bf-discount')?.value) || 0;
    const discountVal = subtotal * (discountPercent / 100);
    const total = subtotal - discountVal;

    document.getElementById('budget-subtotal').textContent = UTILS.formatCurrency(subtotal);
    document.getElementById('budget-discount-val').textContent = `- ${UTILS.formatCurrency(discountVal)}`;
    document.getElementById('budget-total').textContent = UTILS.formatCurrency(total);

    return { subtotal, discountVal, total };
  },

  async handleSave(e) {
    e.preventDefault();
    const id = document.getElementById('budget-id').value;
    const { total } = this.calculateTotal();

    const payload = {
      client_id: document.getElementById('bf-client').value,
      title: document.getElementById('bf-title').value,
      valid_until: document.getElementById('bf-valid-until').value,
      status: document.getElementById('bf-status').value,
      notes: document.getElementById('bf-notes').value,
      discount_percent: parseFloat(document.getElementById('bf-discount').value) || 0,
      items: this.items,
      total_amount: total,
      updated_at: new Date().toISOString()
    };

    if (this.items.length === 0) {
      UTILS.toast('Adicione pelo menos um item ao orçamento.', 'warning');
      return;
    }

    let result;
    if (id) {
      result = await APP.db.from('budgets').update(payload).eq('id', id);
    } else {
      payload.created_at = new Date().toISOString();
      result = await APP.db.from('budgets').insert([payload]);
    }

    if (result.error) {
      UTILS.toast('Erro ao salvar orçamento: ' + result.error.message, 'danger');
    } else {
      UTILS.toast('Orçamento salvo com sucesso!', 'success');
      UTILS.closeModal('modal-budget');
      this.load();
    }
  },

  async delete(id) {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;
    
    const { error } = await APP.db.from('budgets').delete().eq('id', id);
    if (error) UTILS.toast('Erro ao excluir: ' + error.message, 'danger');
    else {
      UTILS.toast('Orçamento excluído.');
      this.load();
    }
  },

  async print(id) {
    window.open(`print-budget.html?id=${id}`, '_blank');
  },

  async convertToProject(id) {
    if (!confirm('Deseja criar um projeto a partir deste orçamento?')) return;

    const { data: budget, error: bErr } = await APP.db
      .from('budgets')
      .select('*, clients(name, document, address)')
      .eq('id', id)
      .single();
    
    if (bErr || !budget) return UTILS.toast('Erro ao buscar orçamento detalhado.', 'danger');

    const projectPayload = {
      client_id: budget.client_id,
      name: budget.title,
      status: 'active',
      progress: 0,
      created_at: new Date().toISOString()
    };

    const { data: newProject, error: pErr } = await APP.db.from('projects').insert([projectPayload]).select().single();
    
    if (pErr) {
      UTILS.toast('Erro ao criar projeto: ' + pErr.message, 'danger');
    } else {
      // 1. Create Default Kanban Columns
      const columns = [
        { project_id: newProject.id, name: '📋 Backlog', position: 0 },
        { project_id: newProject.id, name: '🚀 Em Produção', position: 1 },
        { project_id: newProject.id, name: '👀 Revisão', position: 2 },
        { project_id: newProject.id, name: '✅ Concluído', position: 3 }
      ];

      const { data: createdCols, error: cErr } = await APP.db.from('kanban_columns').insert(columns).select().order('position');

      if (!cErr && createdCols && createdCols.length > 0) {
        const firstColId = createdCols[0].id; // Backlog
        const secondColId = createdCols[1].id; // Em Produção
        
        let allTasks = [];
        let position = 0;

        // 2. Intelligent Roadmap Generation
        budget.items.forEach(item => {
          const desc = item.description.toLowerCase();
          
          // Base Task for the item
          allTasks.push({
            project_id: newProject.id,
            column_id: firstColId,
            title: `🎯 Entrega: ${item.description}`,
            priority: 'high',
            position: position++,
            created_at: new Date().toISOString()
          });

          // Injecting specific roadmap steps
          if (desc.includes('site') || desc.includes('landing') || desc.includes('e-commerce')) {
            allTasks.push(
              { project_id: newProject.id, column_id: firstColId, title: '📝 Briefing e Coleta de Ativos', priority: 'medium', position: position++, created_at: new Date().toISOString() },
              { project_id: newProject.id, column_id: firstColId, title: '🎨 Estudo de UI/UX e Protótipo', priority: 'medium', position: position++, created_at: new Date().toISOString() },
              { project_id: newProject.id, column_id: firstColId, title: '💻 Desenvolvimento e Integrações', priority: 'high', position: position++, created_at: new Date().toISOString() }
            );
          } else if (desc.includes('logo') || desc.includes('identidade') || desc.includes('branding')) {
            allTasks.push(
              { project_id: newProject.id, column_id: firstColId, title: '🔍 Pesquisa de Referências (Moodboard)', priority: 'medium', position: position++, created_at: new Date().toISOString() },
              { project_id: newProject.id, column_id: firstColId, title: '✏️ Esboços e Conceito Visual', priority: 'medium', position: position++, created_at: new Date().toISOString() },
              { project_id: newProject.id, column_id: firstColId, title: '📦 Exportação e Manual da Marca', priority: 'medium', position: position++, created_at: new Date().toISOString() }
            );
          } else if (desc.includes('tráfego') || desc.includes('ads') || desc.includes('anúncios')) {
            allTasks.push(
              { project_id: newProject.id, column_id: firstColId, title: '📊 Auditoria de Contas e Pixels', priority: 'high', position: position++, created_at: new Date().toISOString() },
              { project_id: newProject.id, column_id: firstColId, title: '🖼️ Criação de Criativos/Copy', priority: 'medium', position: position++, created_at: new Date().toISOString() },
              { project_id: newProject.id, column_id: firstColId, title: '🚀 Lançamento de Campanhas', priority: 'high', position: position++, created_at: new Date().toISOString() }
            );
          }
        });

        // 3. Welcome Card
        allTasks.unshift({
          project_id: newProject.id,
          column_id: firstColId,
          title: '👋 Boas-vindas ao Projeto!',
          priority: 'low',
          position: 0,
          created_at: new Date().toISOString()
        });

        if (allTasks.length > 0) {
          await APP.db.from('tasks').insert(allTasks);
        }
      }

      // 4. Create Invoice in Finance
      const invoicePayload = {
        client_id:  budget.client_id,
        project_id: newProject.id,
        total:      budget.total_amount || 0,
        status:     'sent',
        due_date:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes:      `Fatura gerada automaticamente do Orçamento #${budget.id.split('-')[0].toUpperCase()}`
      };

      const { data: newInvoice, error: invError } = await APP.db.from('invoices').insert([invoicePayload]).select().single();
      
      if (invError) {
        console.error("Erro ao gerar fatura:", invError);
      } else if (newInvoice && budget.items) {
        // Create individual items in 'invoice_items' table
        const invoiceItems = budget.items.map(item => ({
          invoice_id:  newInvoice.id,
          description: item.description,
          quantity:    item.quantity || 1,
          unit_price:  item.unit_price || 0
        }));
        await APP.db.from('invoice_items').insert(invoiceItems);
      }

      // 5. Create Service Contract (Professional Model)
      const client = budget.clients || {};
      const clientName = client.name || '________________';
      const clientDoc  = client.document || '________________';
      const clientAddr = client.address || '________________';

      const contractContent = `
        <div style="font-family: 'Times New Roman', Times, serif; line-height: 1.6; color: #1a1a1a; padding: 50px; background: #fff; border: 1px solid #eee; position: relative; max-width: 800px; margin: auto; box-shadow: 0 0 20px rgba(0,0,0,0.05);">
          
          <!-- Letterhead Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff5722; padding-bottom: 20px; margin-bottom: 40px;">
            <div>
              <h1 style="margin: 0; color: #000; font-family: sans-serif; letter-spacing: 2px;">HIGHER</h1>
              <p style="margin: 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #666;">Intelligence & Digital Agency</p>
            </div>
            <div style="text-align: right; font-size: 0.75rem; color: #999; font-family: sans-serif;">
              Cód. Documento: ${budget.id.split('-')[0].toUpperCase()}<br>
              Emitido em: ${new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>

          <h2 style="text-align: center; text-transform: uppercase; font-family: sans-serif; margin-bottom: 30px; letter-spacing: 1px;">Contrato de Prestação de Serviços Digitais</h2>
          
          <div style="text-align: justify;">
            <p><strong>CONTRATADA:</strong> <strong>AGÊNCIA HIGHER</strong>, doravante denominada simplesmente CONTRATADA.</p>
            <p><strong>CONTRATANTE:</strong> <strong>${clientName}</strong>, inscrito sob o CPF/CNPJ n.º <strong>${clientDoc}</strong>, residente ou sediado em ${clientAddr}, doravante denominada simplesmente CONTRATANTE.</p>

            <h4 style="text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">1. DO OBJETO</h4>
            <p>O presente instrumento tem como objeto a prestação de serviços especializados de <strong>${budget.title}</strong>, compreendendo as seguintes atividades:</p>
            <ul style="padding-left: 20px;">
              ${budget.items.map(i => `<li style="margin-bottom: 5px;">${i.description} (Quantidade: ${i.quantity})</li>`).join('')}
            </ul>

            <h4 style="text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">2. DO INVESTIMENTO E FORMA DE PAGAMENTO</h4>
            <p>Pela execução dos serviços, a CONTRATANTE pagará à CONTRATADA o valor total de <strong>${UTILS.formatCurrency(budget.total_amount)}</strong>.</p>
            <p>As condições de parcelamento e métodos de pagamento seguem o estabelecido na fatura financeira vinculada a este contrato.</p>

            <h4 style="text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">3. DAS RESPONSABILIDADES</h4>
            <p>A CONTRATADA obriga-se a executar os serviços com o mais alto padrão de qualidade técnica. A CONTRATANTE obriga-se a fornecer, em tempo hábil, todas as informações e materiais necessários para a viabilização do projeto.</p>

            <h4 style="text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">4. CONFIDENCIALIDADE E PROPRIEDADE</h4>
            <p>As partes comprometem-se a manter sigilo absoluto sobre informações estratégicas trocadas durante a vigência deste contrato. A propriedade intelectual dos ativos criados será transferida à CONTRATANTE após a quitação total dos valores.</p>

            <h4 style="text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">5. DO FORO</h4>
            <p>Para dirimir quaisquer controvérsias oriundas deste CONTRATO, as partes elegem o foro da comarca da CONTRATADA.</p>
          </div>

          <!-- Signatures -->
          <div style="margin-top: 80px; display: flex; justify-content: space-between; gap: 40px;">
            <div style="flex: 1; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 10px;">
                <p style="margin: 0; font-weight: bold; font-family: sans-serif;">AGÊNCIA HIGHER</p>
                <p style="margin: 0; font-size: 0.8rem; color: #666;">Contratada</p>
              </div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="border-top: 1px solid #000; padding-top: 10px;">
                <p style="margin: 0; font-weight: bold; font-family: sans-serif;">${clientName}</p>
                <p style="margin: 0; font-size: 0.8rem; color: #666;">Contratante</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top: 50px; text-align: center; font-size: 0.7rem; color: #aaa; font-family: sans-serif; border-top: 1px solid #f9f9f9; padding-top: 10px;">
            Este documento é parte integrante do sistema de gestão Higher CRM.
          </div>
        </div>
      `;

      const contractPayload = {
        client_id:  budget.client_id,
        project_id: newProject.id,
        budget_id:  budget.id,
        content:    contractContent,
        status:     'draft'
      };

      const { error: cntError } = await APP.db.from('contracts').insert([contractPayload]);
      if (cntError) console.error("Erro ao gerar contrato:", cntError);

      UTILS.toast('Projeto, Fatura e Contrato gerados com sucesso! 🚀', 'success');
      window.switchView('projects');
    }
  },

  copyShareLink(id) {
    const url = `${window.location.origin}/view-budget.html?id=${id}`;
    navigator.clipboard.writeText(url).then(() => {
      UTILS.toast('Link copiado para a área de transferência!', 'success');
    }).catch(err => {
      UTILS.toast('Erro ao copiar link.', 'danger');
    });
  }
};

// Global Exposure
window.openBudgetModal = (id) => BUDGETS.openModal(id);
window.addBudgetItem = () => BUDGETS.addItem();
window.removeBudgetItem = (index) => BUDGETS.removeItem(index);
window.updateBudgetItem = (index, field, value) => BUDGETS.updateItem(index, field, value);
window.calculateBudgetTotal = () => BUDGETS.calculateTotal();
window.deleteBudget = (id) => BUDGETS.delete(id);
window.printBudget = (id) => BUDGETS.print(id);
window.convertBudgetToProject = (id) => BUDGETS.convertToProject(id);
window.copyBudgetLink = (id) => BUDGETS.copyShareLink(id);
window.handleBudgetProductSelect = (index, val) => BUDGETS.handleProductSelect(index, val);

document.getElementById('budgets-search')?.addEventListener('input', UTILS.debounce(() => BUDGETS.load(), 300));
document.getElementById('budget-filter-status')?.addEventListener('change', () => BUDGETS.load());

document.getElementById('budget-form')?.addEventListener('submit', (e) => BUDGETS.handleSave(e));
