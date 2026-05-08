/**
 * HIGHER CRM — CONTRACTS MODULE
 */
import { APP } from './app-state.js';
import { UTILS } from './utils.js';

export const CONTRACTS = {
  data: [],

  async load() {
    const { data, error } = await APP.db
      .from('contracts')
      .select('*, clients(name), projects(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Contracts] Error:', error);
      return;
    }

    this.data = data || [];
    this.render();
  },

  render() {
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;

    if (this.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted)">Nenhum contrato gerado ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = this.data.map(c => `
      <tr>
        <td><strong>${UTILS.escHtml(c.projects?.name || 'Projeto s/ nome')}</strong><br><small style="color:var(--text-3)">ID: ${c.id.toString().slice(0,8).toUpperCase()}</small></td>
        <td>${UTILS.escHtml(c.clients?.name || 'Cliente removido')}</td>
        <td>${UTILS.formatDate(c.created_at)}</td>
        <td><span class="status-badge badge-${c.signature_status || 'pending'}">${c.signature_status === 'signed' ? '✅ Assinado' : '⏳ Pendente'}</span></td>
        <td>
          <div class="actions">
            <button class="btn-icon" onclick="viewContract('${c.id}')" title="Visualizar">👁️</button>
            <button class="btn-icon" onclick="sendToSignature('${c.id}')" title="Enviar para Assinatura">📩</button>
            <button class="btn-icon" onclick="deleteContract('${c.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  view(id) {
    const contract = this.data.find(c => c.id === id);
    if (!contract) return;

    const viewer = document.getElementById('contract-viewer-content');
    if (viewer) {
      viewer.innerHTML = `<div class="paper-sheet">${contract.content || '<p>Erro: Conteúdo do contrato vazio.</p>'}</div>`;
      UTILS.openModal('modal-view-contract');
    }
  },

  async delete(id) {
    if (!confirm('Tem certeza que deseja excluir este contrato?')) return;
    const { error } = await APP.db.from('contracts').delete().eq('id', id);
    if (error) UTILS.toast('Erro ao excluir contrato', 'error');
    else {
      UTILS.toast('Contrato excluído!');
      this.load();
    }
  },

  print() {
    const content = document.getElementById('contract-viewer-content').innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>Contrato - Agência Higher</title></head>
        <style>
          @media print { .paper-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; } }
          body { font-family: 'Times New Roman', serif; }
        </style>
        <body onload="window.print();window.close()">
          <div class="paper-sheet">${content}</div>
        </body>
      </html>
    `);
    win.document.close();
  },

  sendToSignature(id) {
    const contract = this.data.find(c => c.id === id);
    if (!contract) return;

    // Gerar link de assinatura (simulado para o portal do cliente)
    const signLink = `${window.location.origin}/client-portal.html?sign=${id}`;
    const message = `Olá! Segue o link para assinatura digital do nosso contrato: ${signLink}`;
    
    // Abrir WhatsApp com a mensagem
    const whatsappUrl = `https://wa.me/${contract.clients?.whatsapp || ''}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    UTILS.toast('Link de assinatura gerado e enviado!', 'success');
  }
};

// Global Exposure
window.viewContract = (id) => CONTRACTS.view(id);
window.deleteContract = (id) => CONTRACTS.delete(id);
window.printCurrentContract = () => CONTRACTS.print();
window.sendToSignature = (id) => CONTRACTS.sendToSignature(id);
