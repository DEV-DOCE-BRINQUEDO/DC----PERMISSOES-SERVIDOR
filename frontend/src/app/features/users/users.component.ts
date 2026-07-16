import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { UsersService } from '../../core/services/users.service';
import { GroupsService } from '../../core/services/groups.service';
import { User, Group, Server } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';
import { UserPermissionsDialogComponent } from './user-permissions-dialog.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule, MatInputModule
  ],
  template: `
    <div class="users-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Usuarios</h1>
          <p class="page-subtitle">{{ filteredUsers().length }} usuario(s) encontrado(s)</p>
        </div>
      </div>

      <div class="toolbar">
        <div class="server-select-wrap">
          <label class="server-label">Servidor</label>
          <select class="server-select-native" (change)="onNativeServerChange($event)">
            @for (srv of servers(); track srv.id) {
              <option [value]="srv.id" [selected]="srv.id === selectedServerId()">{{ srv.name }} ({{ srv.ip }})</option>
            }
          </select>
        </div>

        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input
            type="text"
            placeholder="Buscar por nome, email ou username..."
            [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
          />
          @if (searchQuery()) {
            <button class="clear-btn" (click)="searchQuery.set('')"><mat-icon>close</mat-icon></button>
          }
        </div>
        <div class="filter-chips">
          <button class="chip" [class.active]="statusFilter() === ''" (click)="statusFilter.set('')">Todos</button>
          <button class="chip" [class.active]="statusFilter() === 'active'" (click)="statusFilter.set('active')">Ativos</button>
          <button class="chip" [class.active]="statusFilter() === 'inactive'" (click)="statusFilter.set('inactive')">Inativos</button>
        </div>
      </div>

      <!-- Table -->
      @if (loading()) {
        <div class="loading-wrap">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="skeleton-row"></div>
          }
        </div>
      } @else {
        <div class="table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Username</th>
                <th>Perfil</th>
                <th>Grupos</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (user of filteredUsers(); track user.id) {
                <tr class="table-row clickable" (click)="openUserPermissions(user)" title="Clique para ver as permissões">
                  <td>
                    <div class="user-cell">
                      <div class="avatar">{{ user.name.charAt(0).toUpperCase() }}</div>
                      <div>
                        <span class="user-name">{{ user.name }}</span>
                        <span class="user-email">{{ user.email }}</span>
                      </div>
                    </div>
                  </td>
                  <td><code class="username">{{ user.username }}</code></td>
                  <td>
                    <span class="role-badge" [class.admin]="user.role === 'admin'">
                      <mat-icon>{{ user.role === 'admin' ? 'admin_panel_settings' : 'person' }}</mat-icon>
                      {{ user.role === 'admin' ? 'Admin' : 'Usuario' }}
                    </span>
                  </td>
                  <td>
                    <div class="groups-cell">
                      @if (user.groups.length === 0) {
                        <span class="no-groups">Sem grupos</span>
                      }
                      @for (gId of user.groups.slice(0, 2); track gId) {
                        <span class="group-tag">{{ getGroupName(gId) }}</span>
                      }
                      @if (user.groups.length > 2) {
                        <span class="group-more">+{{ user.groups.length - 2 }}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="status-badge" [class.active]="user.status === 'active'">
                      <span class="dot"></span>
                      {{ user.status === 'active' ? 'Ativo' : 'Inativo' }}
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="empty-state">
                    <mat-icon>group_off</mat-icon>
                    <p>Nenhum usuario encontrado</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .users-page { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page-subtitle { color: var(--text-muted); font-size: 14px; margin: 0; }

    .toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    /* Server selector nativo */
    .server-select-wrap {
      display: flex; flex-direction: column; gap: 4px;
    }
    .server-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--text-muted); font-weight: 700;
    }
    .server-select-native {
      appearance: none;
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 2px solid var(--border-color);
      border-radius: 10px;
      padding: 10px 36px 10px 14px;
      font-size: 15px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      outline: none;
      min-width: 240px;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.05);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
    }
    .server-select-native:hover, .server-select-native:focus { 
      border-color: var(--accent-color); 
      box-shadow: 0 4px 12px rgba(99,102,241,0.15);
    }
    .server-select-native option { background: var(--bg-surface); color: var(--text-primary); }
    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 8px 16px;
      flex: 1;
      min-width: 260px;
    }
    .search-box mat-icon { color: var(--text-muted); }
    .search-box input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: var(--text-primary);
      font-size: 14px;
    }
    .search-box input::placeholder { color: var(--text-muted); }
    .clear-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; padding: 0; }
    .filter-chips { display: flex; gap: 8px; }
    .chip {
      padding: 6px 16px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .chip.active { background: var(--accent-bg); color: var(--accent-color); border-color: var(--accent-color); }

    .skeleton-row {
      height: 56px;
      background: var(--bg-surface);
      border-radius: 8px;
      margin-bottom: 4px;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0%,100% { opacity:0.5 } 50% { opacity:1 } }

    .table-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      overflow: hidden;
    }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      padding: 14px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-hover);
    }
    .table-row td { padding: 14px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    .table-row:last-child td { border-bottom: none; }
    .table-row:hover td { background: var(--bg-hover); }
    .table-row.clickable { cursor: pointer; transition: background 0.2s; }
    .table-row.clickable:active { background: rgba(0, 0, 0, 0.05); }

    .user-cell { display: flex; align-items: center; gap: 12px; }
    .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--accent-gradient); display: flex; align-items: center;
      justify-content: center; font-weight: 700; color: white; flex-shrink: 0;
    }
    .user-name { display: block; font-weight: 500; color: var(--text-primary); font-size: 14px; }
    .user-email { display: block; font-size: 12px; color: var(--text-muted); }

    code.username {
      background: var(--bg-hover);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      color: var(--accent-color);
    }

    .role-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
      background: rgba(99,102,241,0.1); color: var(--accent-color);
    }
    .role-badge.admin { background: rgba(234,179,8,0.1); color: #eab308; }
    .role-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .groups-cell { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
    .group-tag {
      padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 500;
      background: rgba(139,92,246,0.15); color: #8b5cf6;
    }
    .group-more { font-size: 11px; color: var(--text-muted); }
    .no-groups { font-size: 12px; color: var(--text-muted); font-style: italic; }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
      background: rgba(239,68,68,0.1); color: #ef4444;
    }
    .status-badge.active { background: rgba(34,197,94,0.1); color: #22c55e; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    .empty-state {
      text-align: center !important;
      padding: 48px !important;
      color: var(--text-muted);
    }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.4; }
    .empty-state p { margin: 8px 0 0; }
  `]
})
export class UsersComponent implements OnInit {
  users = signal<User[]>([]);
  availableGroups = signal<Group[]>([]);
  servers = signal<Server[]>([]);
  selectedServerId = signal<string>('');
  loading = signal(true);

  searchQuery = signal('');
  statusFilter = signal('');

  private ignoreList = [
    'system', 'administrators', 'administradores', 'users', 'usuarios', 'guests', 'convidados', 
    'creator owner', 'proprietario criador', 'creator group', 'grupo criador', 
    'everyone', 'todos', 'iis_iusrs', 'network service', 'servico de rede', 
    'local service', 'servico local', 'authenticated users', 'usuarios autenticados',
    'interactive', 'interativo', 'network', 'rede', 'service', 'servico', 
    'anonymous logon', 'logon anonimo', 'trustedinstaller', 'defaultaccount', 'guest', 'convidado',
    'wdiadmin', 'fontdrvhost', 'dwm', 'umfd', 'nt service', 'apppool', 'desconhecido'
  ];

  private isIgnored(name: string): boolean {
    if (!name) return true;
    let n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes('\\')) n = n.split('\\')[1];
    
    // Lista exata
    if (this.ignoreList.includes(n)) return true;
    if (n === 'administrador' || n === 'sistema' || n === 'wdagutilityaccount') return true;
    
    // Prefixos e Hashes
    if (n.startsWith('nt authority') || n.startsWith('builtin') || n.startsWith('window manager') || n.startsWith('nt service')) return true;
    if (n.startsWith('s-1-')) return true; // SIDs (hashes de usuario)
    if (n.startsWith('sqlexpress')) return true;
    
    // Nomes com "teste" ou "test"
    if (n.includes('teste') || n.includes('test')) return true;

    return false;
  }

  filteredUsers = computed(() => {
    // 1. Filtra ignorados e deduplica por nome base, mantendo o de maior permissao (admin > user)
    const uniqueUsers = new Map<string, User>();
    
    for (const u of this.users()) {
      if (this.isIgnored(u.username) || this.isIgnored(u.name)) continue;
      
      // Usa o username limpo (sem dominio) como chave de deduplicação
      let baseUsername = u.username.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (baseUsername.includes('\\')) baseUsername = baseUsername.split('\\')[1];
      
      const existing = uniqueUsers.get(baseUsername);
      if (!existing) {
        uniqueUsers.set(baseUsername, u);
      } else {
        // Se já existe, mantém o que tem perfil 'admin' (permissão maior mostrando)
        if (u.role === 'admin' && existing.role !== 'admin') {
          uniqueUsers.set(baseUsername, u);
        }
      }
    }

    // 2. Aplica os filtros de busca e status na lista deduplicada
    return Array.from(uniqueUsers.values()).filter(u => {
      const q = this.searchQuery().toLowerCase();
      const matchesSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.username.toLowerCase().includes(q);
      const matchesStatus = !this.statusFilter() || u.status === this.statusFilter();
      return matchesSearch && matchesStatus;
    });
  });

  constructor(
    private usersService: UsersService,
    private groupsService: GroupsService,
    private api: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadServers();
  }

  loadServers() {
    this.api.get<Server[]>('/servers').subscribe(s => {
      this.servers.set(s);
      if (s.length > 0 && !this.selectedServerId()) {
        this.selectedServerId.set(s[0].id);
      }
      this.loadData();
    });
  }

  onServerChange(id: string) {
    this.selectedServerId.set(id);
    this.loadData();
  }

  onNativeServerChange(event: Event) {
    const sel = event.target as HTMLSelectElement;
    if (sel?.value) {
      this.selectedServerId.set(sel.value);
      this.loadData();
    }
  }

  loadData() {
    this.loading.set(true);
    const sId = this.selectedServerId() || undefined;
    this.usersService.getAll(sId).subscribe({
      next: users => { this.users.set(users); this.loading.set(false); },
      error: () => { this.users.set([]); this.loading.set(false); }
    });
    this.groupsService.getAll(sId).subscribe(groups => this.availableGroups.set(groups));
  }

  getGroupName(id: string): string {
    return this.availableGroups().find(g => g.id === id)?.name || id;
  }

  openUserPermissions(user: User) {
    this.dialog.open(UserPermissionsDialogComponent, {
      width: '750px',
      maxWidth: '95vw',
      panelClass: 'custom-dialog-container',
      data: { user }
    });
  }
}
