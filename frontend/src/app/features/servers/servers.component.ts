import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ServersService } from '../../core/services/servers.service';
import { Server } from '../../core/models/models';

@Component({
  selector: 'app-servers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule
  ],
  template: `
    <div class="servers-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Servidores (Agentes)</h1>
          <p class="page-subtitle">{{ servers().length }} servidor(es) cadastrado(s)</p>
        </div>
        <div class="header-actions">
          <button class="help-btn" (click)="showHelp.set(true)">
            <mat-icon>help_outline</mat-icon>
            Como configurar
          </button>
          <button class="add-btn" (click)="openModal()">
            <mat-icon>add</mat-icon>
            Adicionar Servidor
          </button>
        </div>
      </div>

      <div class="servers-grid">
        @if (loading()) {
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-card"></div>
          }
        } @else if (servers().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">
              <mat-icon>dns</mat-icon>
            </div>
            <h3>Nenhum servidor cadastrado</h3>
            <p>Adicione um servidor Windows com o Agente rodando para sincronizar os dados.</p>
            <button class="add-btn" (click)="openModal()">
              <mat-icon>add</mat-icon>
              Adicionar Primeiro Servidor
            </button>
          </div>
        } @else {
          @for (server of servers(); track server.id) {
            <div class="server-card" [class.syncing]="server.syncStatus === 'syncing'">
              <div class="card-top">
                <div class="server-icon" [class.error]="server.syncStatus === 'failed'" [class.success]="server.syncStatus === 'success'">
                  <mat-icon>dns</mat-icon>
                </div>
                <div class="status-badge-wrap">
                  @if (server.syncStatus === 'syncing') {
                    <span class="status-badge syncing">
                      <span class="spinner-small"></span>
                      Sincronizando...
                    </span>
                  } @else if (server.syncStatus === 'success') {
                    <span class="status-badge success">
                      <mat-icon>check_circle</mat-icon>
                      Sincronizado
                    </span>
                  } @else if (server.syncStatus === 'failed') {
                    <span class="status-badge error">
                      <mat-icon>error</mat-icon>
                      Falha
                    </span>
                  } @else {
                    <span class="status-badge idle">
                      <mat-icon>schedule</mat-icon>
                      Aguardando
                    </span>
                  }
                </div>
              </div>

              <div class="server-body">
                <h3 class="server-name">{{ server.name }}</h3>

                <div class="server-detail">
                  <mat-icon>lan</mat-icon>
                  <span>{{ server.ip }}:{{ server.agentPort || 3001 }}</span>
                </div>

                @if (server.rootPath) {
                  <div class="server-detail accent">
                    <mat-icon>folder_open</mat-icon>
                    <span class="root-path">{{ server.rootPath }}</span>
                  </div>
                }

                <div class="sync-info">
                  <span class="sync-title">Ultima Sincronizacao:</span>
                  <span class="sync-time">
                    {{ server.lastSyncedAt ? (server.lastSyncedAt | date:'dd/MM/yyyy HH:mm:ss') : 'Nunca sincronizado' }}
                  </span>
                </div>

                @if (server.syncStatus === 'failed' && server.syncError) {
                  <div class="error-box">
                    <mat-icon>warning</mat-icon>
                    <p class="error-text">{{ server.syncError }}</p>
                  </div>
                }
              </div>

              <div class="card-actions">
                <button 
                  class="action-btn-sync" 
                  [disabled]="server.syncStatus === 'syncing'" 
                  matTooltip="Forcar sincronizacao agora" 
                  (click)="syncServer(server)"
                >
                  <mat-icon [class.spin]="server.syncStatus === 'syncing'">sync</mat-icon>
                  {{ server.syncStatus === 'syncing' ? 'Sincronizando' : 'Sincronizar' }}
                </button>
                <button class="action-btn" matTooltip="Editar configuracoes" (click)="openModal(server)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button class="action-btn danger" matTooltip="Remover servidor" (click)="confirmDelete(server)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- Modal Adicionar/Editar -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-row">
              <div class="modal-icon">
                <mat-icon>{{ editingServer() ? 'edit' : 'add_to_queue' }}</mat-icon>
              </div>
              <div>
                <h2>{{ editingServer() ? 'Editar Servidor' : 'Novo Servidor' }}</h2>
                <p>{{ editingServer() ? 'Atualize as informacoes de rede e credenciais' : 'Cadastre o IP e a porta onde o Agente esta rodando' }}</p>
              </div>
            </div>
            <button class="close-btn" (click)="closeModal()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <form [formGroup]="serverForm" (ngSubmit)="saveServer()" class="modal-body">
            <div class="form-section">
              <label class="form-label">Identificacao</label>
              <div class="form-field">
                <mat-icon class="field-icon">label</mat-icon>
                <input
                  formControlName="name"
                  placeholder="Nome do servidor (ex: Servidor de Arquivos)"
                  [class.error]="serverForm.get('name')?.invalid && serverForm.get('name')?.touched"
                />
              </div>
              @if (serverForm.get('name')?.invalid && serverForm.get('name')?.touched) {
                <span class="error-msg">Nome obrigatorio</span>
              }
            </div>

            <div class="form-section">
              <label class="form-label">Endereco IP ou Hostname</label>
              <div class="form-field">
                <mat-icon class="field-icon">lan</mat-icon>
                <input
                  formControlName="ip"
                  placeholder="Ex: 192.168.13.10"
                  [class.error]="serverForm.get('ip')?.invalid && serverForm.get('ip')?.touched"
                />
              </div>
              @if (serverForm.get('ip')?.invalid && serverForm.get('ip')?.touched) {
                <span class="error-msg">IP ou Hostname obrigatorio</span>
              }
            </div>

            <div class="form-row-2">
              <div class="form-section">
                <label class="form-label">Porta do Agente</label>
                <div class="form-field">
                  <mat-icon class="field-icon">settings_ethernet</mat-icon>
                  <input
                    type="number"
                    formControlName="agentPort"
                    placeholder="3001"
                  />
                </div>
              </div>
            </div>

            <div class="form-section">
              <label class="form-label">Token de Sincronizacao</label>
              <div class="form-field">
                <mat-icon class="field-icon">vpn_key</mat-icon>
                <input
                  formControlName="token"
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Insira o Token do Agente"
                />
                <button type="button" class="toggle-pass" (click)="showPassword.set(!showPassword())">
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
              <span class="field-hint">Token de seguranca configurado no index.js do Agente remoto.</span>
            </div>

            <div class="form-section">
              <label class="form-label">
                Pasta Raiz do Servidor
                <span class="label-hint">(opcional)</span>
              </label>
              <div class="form-field">
                <mat-icon class="field-icon">folder_open</mat-icon>
                <input
                  formControlName="rootPath"
                  placeholder="Ex: D:\\Dados"
                />
              </div>
              <span class="field-hint">
                Caminho local no servidor de destino. Deixe vazio para varrer C:\\.
              </span>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-save" [disabled]="saving()">
                @if (saving()) {
                  <span class="spinner"></span>
                  Testando e Salvando...
                } @else {
                  <mat-icon>save</mat-icon>
                  {{ editingServer() ? 'Salvar Alteracoes' : 'Adicionar Servidor' }}
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Modal Confirmar Delete -->
    @if (deletingServer()) {
      <div class="modal-backdrop" (click)="deletingServer.set(null)">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-row">
              <div class="modal-icon danger">
                <mat-icon>warning</mat-icon>
              </div>
              <div>
                <h2>Remover Servidor</h2>
                <p>Esta acao nao pode ser desfeita</p>
              </div>
            </div>
          </div>
          <div class="modal-body">
            <p class="delete-msg">
              Tem certeza que deseja remover o servidor <strong>{{ deletingServer()!.name }}</strong>? Isso tambem apagara todos os dados sincronizados dele localmente.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-cancel" (click)="deletingServer.set(null)">Cancelar</button>
            <button type="button" class="btn-danger" (click)="deleteServer()" [disabled]="saving()">
              <mat-icon>delete</mat-icon>
              Remover
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal Instrucoes -->
    @if (showHelp()) {
      <div class="modal-backdrop" (click)="showHelp.set(false)">
        <div class="modal modal-help" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-row">
              <div class="modal-icon help">
                <mat-icon>terminal</mat-icon>
              </div>
              <div>
                <h2>Como configurar o Agente nos Servidores</h2>
                <p>O DC Manager agora funciona consultando agentes locais instalados em cada servidor</p>
              </div>
            </div>
            <button class="close-btn" (click)="showHelp.set(false)">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="modal-body help-body">
            <div class="help-alert info">
              <mat-icon>info</mat-icon>
              <p>Ao rodar o Agente localmente no servidor de destino, eliminamos a necessidade de abrir portas de RPC/ADSI remotamente na rede, tornando as consultas imediatas, otimizadas e seguras.</p>
            </div>

            <div class="help-step">
              <div class="step-num">1</div>
              <div class="step-content">
                <h4>Copiar a pasta do Agente</h4>
                <p>Copie a pasta <code>agent/</code> do projeto para o servidor Windows que deseja monitorar.</p>
              </div>
            </div>

            <div class="help-step">
              <div class="step-num">2</div>
              <div class="step-content">
                <h4>Instalar as Dependencias e Iniciar</h4>
                <p>Abra o Prompt de Comando (CMD) ou PowerShell como Administrador na pasta copiada e execute:</p>
                <div class="code-block">
                  <code>npm install</code>
                </div>
                <p style="margin-top: 8px;">Em seguida, inicie o servico:</p>
                <div class="code-block">
                  <code>npm start</code>
                </div>
                <p style="margin-top: 8px; font-size:12px; color:var(--text-muted);">
                  Dica: Para producao, voce pode instalar como um servico do Windows usando o utilitario <code>qckwinsvc</code> ou <code>pm2-windows-service</code>.
                </p>
              </div>
            </div>

            <div class="help-step">
              <div class="step-num">3</div>
              <div class="step-content">
                <h4>Token de Sincronizacao</h4>
                <p>Por padrao o token de seguranca eh <code>dc_manager_secret_token</code>. Voce pode alterar no arquivo <code>index.js</code> do agente na variavel <code>SYNC_TOKEN</code> ou passando como variavel de ambiente.</p>
              </div>
            </div>

            <div class="help-step">
              <div class="step-num">4</div>
              <div class="step-content">
                <h4>Liberar Porta no Firewall do Servidor de Destino</h4>
                <p>Para o servidor do BI (192.168.13.249) conseguir consultar o agente, libere a porta (padrao 3001) no firewall do servidor Windows:</p>
                <div class="code-block">
                  <code>netsh advfirewall firewall add rule name="DC Manager Agent" dir=in action=allow protocol=TCP localport=3001</code>
                </div>
              </div>
            </div>

            <div class="help-step">
              <div class="step-num">5</div>
              <div class="step-content">
                <h4>Vantagens do Novo Modelo</h4>
                <ul class="help-list">
                  <li><mat-icon>bolt</mat-icon> <strong>Visualizacao Instantanea:</strong> Sem lag ao expandir pastas no portal, pois tudo eh consultado do SQLite local.</li>
                  <li><mat-icon>sync</mat-icon> <strong>Sincronizacao em Background:</strong> Cron executado automaticamente todos os dias a meia-noite (00:00).</li>
                  <li><mat-icon>shield</mat-icon> <strong>Segurança:</strong> O BI nao armazena mais senhas de administrador dos seus servidores de arquivos.</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-save" (click)="showHelp.set(false)">
              <mat-icon>check</mat-icon>
              Entendido
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .servers-page { display: flex; flex-direction: column; gap: 24px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page-subtitle { color: var(--text-muted); font-size: 14px; margin: 0; }
    .header-actions { display: flex; gap: 12px; align-items: center; }

    .help-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-radius: 10px;
      background: transparent; border: 1px solid var(--border-color);
      color: var(--text-muted); font-size: 14px; font-weight: 500; cursor: pointer;
      transition: all 0.2s;
    }
    .help-btn:hover { border-color: var(--accent-color); color: var(--accent-color); background: var(--accent-bg); }
    .help-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .add-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-radius: 10px;
      background: var(--accent-color); color: white; border: none;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .add-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .add-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* Grid */
    .servers-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px;
    }

    /* Empty */
    .empty-state {
      grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 16px;
      padding: 80px 20px; text-align: center;
      background: var(--bg-surface); border: 2px dashed var(--border-color); border-radius: 20px;
    }
    .empty-icon {
      width: 72px; height: 72px; border-radius: 20px;
      background: var(--accent-bg); color: var(--accent-color);
      display: flex; align-items: center; justify-content: center;
    }
    .empty-icon mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--text-secondary); margin: 0; }
    .empty-state p { color: var(--text-muted); font-size: 14px; margin: 0; max-width: 360px; }

    /* Cards */
    .server-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 18px;
      transition: all 0.25s ease; position: relative;
    }
    .server-card:hover {
      border-color: var(--accent-color); transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(0,0,0,0.2);
    }
    .server-card.syncing { border-color: #6366f1; }
    
    .card-top { display: flex; align-items: center; justify-content: space-between; }
    
    .server-icon {
      width: 48px; height: 48px; border-radius: 12px;
      background: var(--bg-hover); color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.3s;
    }
    .server-icon.success { background: rgba(34,197,94,0.1); color: #22c55e; }
    .server-icon.error { background: rgba(239,68,68,0.1); color: #ef4444; }
    .server-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .status-badge-wrap { display: flex; align-items: center; }
    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .status-badge.syncing { background: rgba(99,102,241,0.15); color: #818cf8; }
    .status-badge.success { background: rgba(34,197,94,0.15); color: #4ade80; }
    .status-badge.error { background: rgba(239,68,68,0.15); color: #f87171; }
    .status-badge.idle { background: rgba(156,163,175,0.15); color: #9ca3af; }
    .status-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .spinner-small {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8;
      animation: spin 0.8s linear infinite;
    }

    .server-body { display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .server-name { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .server-detail { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); }
    .server-detail mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-muted); }
    .server-detail.accent { color: var(--accent-color); }
    .server-detail.accent mat-icon { color: var(--accent-color); }
    .root-path { font-family: monospace; font-size: 12px; }

    .sync-info {
      margin-top: 6px; padding-top: 8px; border-top: 1px dashed var(--border-color);
      display: flex; flex-direction: column; gap: 2px;
    }
    .sync-title { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
    .sync-time { font-size: 12px; font-weight: 500; color: var(--text-secondary); }

    .error-box {
      margin-top: 8px; padding: 10px 12px; background: rgba(239,68,68,0.06);
      border: 1px solid rgba(239,68,68,0.15); border-radius: 8px;
      display: flex; gap: 8px; align-items: flex-start;
    }
    .error-box mat-icon { color: #f87171; font-size: 16px; width: 16px; height: 16px; flex-shrink:0; margin-top: 2px; }
    .error-text { font-size: 11px; color: #f87171; margin: 0; line-height: 1.4; }

    .card-actions { display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border-color); }
    
    .action-btn-sync {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px;
      background: var(--accent-bg); color: var(--accent-color); border: 1px solid rgba(99,102,241,0.2);
      font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .action-btn-sync:hover:not(:disabled) { background: var(--accent-color); color: white; }
    .action-btn-sync:disabled { opacity: 0.6; cursor: not-allowed; }
    .action-btn-sync mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .action-btn-sync mat-icon.spin { animation: spin 1s linear infinite; }

    .action-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--bg-hover); border: 1px solid var(--border-color);
      color: var(--text-secondary); cursor: pointer; transition: all 0.2s;
    }
    .action-btn:hover { background: var(--bg-hover); color: var(--text-primary); border-color: var(--text-muted); }
    .action-btn.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: #ef4444; }
    .action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .skeleton-card {
      height: 240px; background: var(--bg-surface);
      border: 1px solid var(--border-color); border-radius: 16px;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0%,100%{opacity:.4} 50%{opacity:.8} }

    /* Modals */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; backdrop-filter: blur(6px); animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    .modal {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 20px; width: 100%; max-width: 520px; max-height: 90vh;
      overflow-y: auto; animation: slideUp 0.25s ease;
    }
    .modal-sm { max-width: 400px; }
    .modal-help { max-width: 680px; }
    @keyframes slideUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }

    .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 24px 24px 0; }
    .modal-title-row { display: flex; align-items: flex-start; gap: 16px; }
    .modal-icon {
      width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
      background: var(--accent-bg); color: var(--accent-color);
      display: flex; align-items: center; justify-content: center;
    }
    .modal-icon.danger { background: rgba(239,68,68,0.1); color: #ef4444; }
    .modal-icon.help { background: rgba(99,102,241,0.12); color: var(--accent-color); }
    .modal-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .modal-header h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .modal-header p { font-size: 13px; color: var(--text-muted); margin: 0; }

    .close-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 4px; border-radius: 8px;
      display: flex; align-items: center; transition: all 0.2s;
    }
    .close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

    .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 20px; }

    .form-section { display: flex; flex-direction: column; gap: 8px; }
    .form-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: flex; gap: 6px; }
    .label-hint { font-weight: 400; color: var(--text-muted); text-transform: none; letter-spacing: 0; }

    .form-field {
      display: flex; align-items: center; gap: 10px;
      background: var(--bg-primary); border: 1px solid var(--border-color);
      border-radius: 10px; padding: 12px 14px; transition: border-color 0.2s;
    }
    .form-field:focus-within { border-color: var(--accent-color); }
    .field-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-muted); flex-shrink: 0; }
    .form-field input { flex: 1; background: none; border: none; outline: none; color: var(--text-primary); font-size: 14px; }
    .form-field input::placeholder { color: var(--text-muted); }
    .form-field input.error { color: #ef4444; }
    
    .toggle-pass { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 0; display: flex; align-items: center; }
    .toggle-pass:hover { color: var(--text-primary); }
    .toggle-pass mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .error-msg { font-size: 12px; color: #ef4444; }
    .field-hint { font-size: 12px; color: var(--text-muted); }

    .delete-msg { font-size: 14px; color: var(--text-secondary); margin: 0; line-height: 1.6; }
    .delete-msg strong { color: var(--text-primary); }

    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 0 24px 24px; }
    
    .btn-cancel {
      padding: 10px 20px; border-radius: 10px;
      background: var(--bg-hover); border: 1px solid var(--border-color);
      color: var(--text-secondary); font-size: 14px; cursor: pointer; transition: all 0.2s;
    }
    .btn-cancel:hover { border-color: var(--accent-color); color: var(--accent-color); }

    .btn-save {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 22px; border-radius: 10px;
      background: var(--accent-color); color: white; border: none;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-save:hover:not(:disabled) { filter: brightness(1.1); }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-save mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .btn-danger {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 22px; border-radius: 10px;
      background: #ef4444; color: white; border: none;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-danger:hover:not(:disabled) { background: #dc2626; }
    .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-danger mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Help Modal Details */
    .help-body { gap: 0; padding-bottom: 0; }
    .help-alert { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 10px; margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
    .help-alert.info { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); color: #93c5fd; }
    .help-alert mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
    .help-alert p { margin: 0; }

    .help-step { display: flex; gap: 16px; padding: 18px 0; border-bottom: 1px solid var(--border-color); }
    .help-step:last-of-type { border-bottom: none; }
    .step-num {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: var(--accent-color); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; margin-top: 1px;
    }
    .step-content { flex: 1; }
    .step-content h4 { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px; }
    .step-content p { font-size: 13px; color: var(--text-secondary); margin: 0 0 10px; line-height: 1.6; }

    .code-block { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; overflow-x: auto; }
    .code-block code { font-family: 'Consolas', monospace; font-size: 12px; color: #a5f3fc; white-space: nowrap; }

    .help-list { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px; }
    .help-list li { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-secondary); }
    .help-list li mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--accent-color); flex-shrink: 0; }
  `]
})
export class ServersComponent implements OnInit, OnDestroy {
  servers = signal<Server[]>([]);
  loading = signal(true);
  saving = signal(false);
  showModal = signal(false);
  showHelp = signal(false);
  showPassword = signal(false);
  editingServer = signal<Server | null>(null);
  deletingServer = signal<Server | null>(null);
  serverForm!: FormGroup;
  pollInterval: any;

  constructor(
    private serversService: ServersService,
    private fb: FormBuilder,
    private snack: MatSnackBar
  ) {}

  ngOnInit() {
    this.buildForm();
    this.loadServers();
    
    // Polling a cada 3 segundos para checar status se houver algum sincronizando
    this.pollInterval = setInterval(() => {
      const isSyncing = this.servers().some(s => s.syncStatus === 'syncing');
      if (isSyncing) {
        this.loadServers(true);
      }
    }, 3000);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  buildForm() {
    this.serverForm = this.fb.group({
      name:      ['', Validators.required],
      ip:        ['', Validators.required],
      agentPort: [3001, [Validators.required, Validators.min(1), Validators.max(65535)]],
      token:     ['dc_manager_secret_token', Validators.required],
      rootPath:  ['C:\\']
    });
  }

  loadServers(silent = false) {
    if (!silent) this.loading.set(true);
    this.serversService.getAll().subscribe({
      next: (data) => { this.servers.set(data); if (!silent) this.loading.set(false); },
      error: (err) => { 
        if (!silent) this.loading.set(false); 
        this.snack.open('Erro ao carregar servidores: ' + (err?.error?.error || err.message), 'OK', { duration: 5000 });
        console.error('Erro ao carregar servidores:', err);
      }
    });
  }

  openModal(server?: Server) {
    this.showPassword.set(false);
    if (server) {
      this.editingServer.set(server);
      this.serverForm.patchValue({
        name:      server.name,
        ip:        server.ip,
        agentPort: server.agentPort || 3001,
        token:     '', // Nao expoe o token no edit por seguranca, envia apenas se alterar
        rootPath:  server.rootPath || 'C:\\'
      });
      this.serverForm.get('token')?.clearValidators();
    } else {
      this.editingServer.set(null);
      this.serverForm.reset({
        agentPort: 3001,
        token: 'dc_manager_secret_token',
        rootPath: 'C:\\'
      });
      this.serverForm.get('token')?.setValidators(Validators.required);
    }
    this.serverForm.get('token')?.updateValueAndValidity();
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingServer.set(null);
    this.serverForm.reset();
  }

  saveServer() {
    this.serverForm.markAllAsTouched();
    if (this.serverForm.invalid) return;

    this.saving.set(true);
    const val = this.serverForm.value;
    const payload: any = {
      name:      val.name,
      ip:        val.ip,
      agentPort: val.agentPort,
      rootPath:  val.rootPath || 'C:\\'
    };

    if (val.token && val.token !== '••••••••') {
      payload.token = val.token;
    }

    const isEdit = !!this.editingServer();
    const req = isEdit
      ? this.serversService.update(this.editingServer()!.id, payload)
      : this.serversService.create(payload);

    req.subscribe({
      next: () => {
        this.snack.open(
          isEdit ? 'Servidor atualizado com sucesso!' : 'Servidor adicionado e sincronizado com sucesso!',
          'OK', { duration: 3000 }
        );
        this.saving.set(false);
        this.closeModal();
        this.loadServers();
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erro ao salvar e testar conexao com o Agente', 'OK', { duration: 5000 });
        this.saving.set(false);
      }
    });
  }

  confirmDelete(server: Server) {
    this.deletingServer.set(server);
  }

  deleteServer() {
    const server = this.deletingServer();
    if (!server) return;
    this.saving.set(true);
    this.serversService.delete(server.id).subscribe({
      next: () => {
        this.snack.open('Servidor removido com sucesso!', 'OK', { duration: 3000 });
        this.saving.set(false);
        this.deletingServer.set(null);
        this.loadServers();
      },
      error: () => {
        this.snack.open('Erro ao remover servidor', 'OK', { duration: 3000 });
        this.saving.set(false);
      }
    });
  }

  syncServer(server: Server) {
    server.syncStatus = 'syncing'; // Feedback visual instantâneo
    this.serversService.sync(server.id).subscribe({
      next: () => {
        // A API retorna 202 dizendo que disparou em background
        this.snack.open('Sincronização iniciada em background...', 'OK', { duration: 3000 });
        this.loadServers(true);
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erro ao iniciar sincronização', 'OK', { duration: 4000 });
        this.loadServers(true);
      }
    });
  }
}
