import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { GroupsService } from '../../core/services/groups.service';
import { UsersService } from '../../core/services/users.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { Group, User, Server } from '../../core/models/models';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatIconModule, MatButtonModule, MatDialogModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatSnackBarModule, MatExpansionModule
  ],
  template: `
    <div class="groups-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Grupos</h1>
          <p class="page-subtitle">{{ groups().length }} grupo(s) cadastrado(s)</p>
        </div>
        <button mat-flat-button class="add-btn" (click)="openForm()">
          <mat-icon>group_add</mat-icon>
          Novo Grupo
        </button>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="server-select">
          <mat-label>Servidor</mat-label>
          <mat-select [value]="selectedServerId()" (selectionChange)="onServerChange($event.value)">
            <mat-option value="">Todos (Local)</mat-option>
            @for (server of servers(); track server.id) {
              <mat-option [value]="server.id">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <mat-icon style="font-size: 18px; width: 18px; height: 18px;">dns</mat-icon>
                  {{ server.name }} ({{ server.ip }})
                </div>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Buscar grupos..." [(ngModel)]="searchQuery" />
        </div>
      </div>

      @if (loading()) {
        <div class="skeleton-grid">
          @for (i of [1,2,3]; track i) { <div class="skeleton-card"></div> }
        </div>
      } @else {
        <div class="groups-grid">
          @for (group of filteredGroups(); track group.id) {
            <div class="group-card">
              <div class="group-card-header">
                <div class="group-icon">
                  <mat-icon>workspaces</mat-icon>
                </div>
                <div class="group-meta">
                  <h3 class="group-name">{{ group.name }}</h3>
                  <p class="group-desc">{{ group.description || 'Sem descrição' }}</p>
                </div>
                <div class="group-actions">
                  <button mat-icon-button matTooltip="Editar" (click)="openForm(group)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Remover" class="delete-btn" (click)="deleteGroup(group)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <div class="members-section">
                <div class="members-header">
                  <span class="members-title">
                    <mat-icon>group</mat-icon>
                    {{ group.membersData?.length || 0 }} membro(s)
                  </span>
                  <button class="add-member-btn" (click)="openAddMember(group)">
                    <mat-icon>person_add</mat-icon>
                    Adicionar
                  </button>
                </div>
                <div class="members-list">
                  @for (member of group.membersData || []; track member.id) {
                    <div class="member-chip">
                      <div class="member-avatar">{{ (member.name || 'U').charAt(0) }}</div>
                      <span class="member-name">{{ member.name }}</span>
                      <span class="member-status" [class.active]="member.status === 'active'">
                        {{ member.status === 'active' ? 'Ativo' : 'Inativo' }}
                      </span>
                      <button
                        class="remove-member-btn"
                        matTooltip="Remover do grupo"
                        (click)="removeMember(group, member.id!)"
                      >
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  } @empty {
                    <p class="no-members">Nenhum membro neste grupo</p>
                  }
                </div>
              </div>

              <div class="group-footer">
                <span class="created-at">Criado em {{ group.createdAt | date:'dd/MM/yyyy' }}</span>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <mat-icon>workspaces</mat-icon>
              <p>Nenhum grupo encontrado</p>
              <button mat-flat-button class="add-btn" (click)="openForm()">Criar primeiro grupo</button>
            </div>
          }
        </div>
      }

      <!-- Form Modal -->
      @if (showForm()) {
        <div class="modal-overlay" (click)="closeForm()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>{{ editingGroup() ? 'Editar Grupo' : 'Novo Grupo' }}</h2>
              <button mat-icon-button (click)="closeForm()"><mat-icon>close</mat-icon></button>
            </div>
            <form [formGroup]="groupForm" (ngSubmit)="saveGroup()" class="modal-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Nome do grupo</mat-label>
                <input matInput formControlName="name" placeholder="ex: Desenvolvedores" />
                <mat-icon matSuffix>workspaces</mat-icon>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Descrição</mat-label>
                <textarea matInput formControlName="description" rows="2" placeholder="Descreva o grupo..."></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Membros</mat-label>
                <mat-select formControlName="members" multiple>
                  @for (user of users(); track user.id) {
                    <mat-option [value]="user.id">
                      {{ user.name }} ({{ user.username }})
                    </mat-option>
                  }
                </mat-select>
                <mat-icon matSuffix>group</mat-icon>
              </mat-form-field>
              <div class="modal-actions">
                <button type="button" mat-stroked-button (click)="closeForm()">Cancelar</button>
                <button type="submit" mat-flat-button class="save-btn" [disabled]="groupForm.invalid || saving()">
                  @if (saving()) { <mat-icon class="spin">refresh</mat-icon> }
                  {{ editingGroup() ? 'Salvar' : 'Criar grupo' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Add Member Modal -->
      @if (showAddMember()) {
        <div class="modal-overlay" (click)="showAddMember.set(false)">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Adicionar Membro — {{ selectedGroup()?.name }}</h2>
              <button mat-icon-button (click)="showAddMember.set(false)"><mat-icon>close</mat-icon></button>
            </div>
            <div class="modal-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Selecionar usuário</mat-label>
                <mat-select [(value)]="selectedUserId">
                  @for (user of availableToAdd(); track user.id) {
                    <mat-option [value]="user.id">{{ user.name }} ({{ user.username }})</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <div class="modal-actions">
                <button mat-stroked-button (click)="showAddMember.set(false)">Cancelar</button>
                <button mat-flat-button class="save-btn" [disabled]="!selectedUserId" (click)="addMember()">
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .groups-page { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page-subtitle { color: var(--text-muted); font-size: 14px; margin: 0; }
    .add-btn { background: var(--accent-color) !important; color: white !important; gap: 6px; }

    .toolbar { display: flex; gap: 12px; align-items: center; }
    .server-select { width: 240px; }
    .search-box {
      display: flex; align-items: center; gap: 10px; flex: 1;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 10px; padding: 10px 16px; height: 56px; box-sizing: border-box;
    }
    .search-box mat-icon { color: var(--text-muted); }
    .search-box input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--text-primary); font-size: 14px;
    }

    .skeleton-grid, .groups-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;
    }
    .skeleton-card { height: 220px; background: var(--bg-surface); border-radius: 16px; animation: shimmer 1.5s infinite; }
    @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }

    .group-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
      transition: box-shadow 0.25s;
    }
    .group-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.25); }

    .group-card-header {
      display: flex; align-items: flex-start; gap: 14px; padding: 20px 20px 16px;
    }
    .group-icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: rgba(139,92,246,0.15); display: flex; align-items: center;
      justify-content: center; flex-shrink: 0;
    }
    .group-icon mat-icon { color: #8b5cf6; font-size: 22px; }
    .group-meta { flex: 1; min-width: 0; }
    .group-name { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .group-desc { font-size: 13px; color: var(--text-muted); margin: 0; }
    .group-actions { display: flex; flex-shrink: 0; }
    .delete-btn { color: #ef4444 !important; }

    .members-section { padding: 0 20px 16px; border-top: 1px solid var(--border-color); }
    .members-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0 10px;
    }
    .members-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; font-weight: 600; color: var(--text-secondary);
    }
    .members-title mat-icon { font-size: 16px; }
    .add-member-btn {
      display: flex; align-items: center; gap: 4px;
      background: var(--accent-bg); border: 1px solid var(--accent-color);
      color: var(--accent-color); border-radius: 8px; padding: 4px 12px;
      font-size: 12px; cursor: pointer; transition: all 0.2s;
    }
    .add-member-btn:hover { background: var(--accent-color); color: white; }
    .add-member-btn mat-icon { font-size: 15px; }
    .members-list { display: flex; flex-direction: column; gap: 6px; }
    .member-chip {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; background: var(--bg-hover); border-radius: 10px;
    }
    .member-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--accent-gradient); display: flex; align-items: center;
      justify-content: center; font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .member-name { flex: 1; font-size: 13px; color: var(--text-primary); font-weight: 500; }
    .member-status {
      font-size: 11px; padding: 2px 8px; border-radius: 12px;
      background: rgba(239,68,68,.1); color: #ef4444;
    }
    .member-status.active { background: rgba(34,197,94,.1); color: #22c55e; }
    .remove-member-btn {
      background: none; border: none; cursor: pointer; color: var(--text-muted);
      display: flex; padding: 0; transition: color 0.2s;
    }
    .remove-member-btn mat-icon { font-size: 16px; }
    .remove-member-btn:hover { color: #ef4444; }
    .no-members { color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0; margin: 0; font-style: italic; }

    .group-footer {
      padding: 12px 20px; background: var(--bg-hover); margin-top: auto;
    }
    .created-at { font-size: 11px; color: var(--text-muted); }

    .empty-state {
      grid-column: 1/-1; text-align: center; padding: 60px;
      color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.3; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; backdrop-filter: blur(4px); animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    .modal {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 20px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto;
      animation: slideUp 0.25s ease;
    }
    .modal-sm { max-width: 380px; }
    @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 24px 0;
    }
    .modal-header h2 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .modal-form { padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 4px; }
    .full-width { width: 100%; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
    .save-btn { background: var(--accent-color) !important; color: white !important; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }
  `]
})
export class GroupsComponent implements OnInit {
  groups = signal<Group[]>([]);
  users = signal<User[]>([]);
  servers = signal<Server[]>([]);
  selectedServerId = signal<string>('');
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  showAddMember = signal(false);
  editingGroup = signal<Group | null>(null);
  selectedGroup = signal<Group | null>(null);
  selectedUserId = '';
  searchQuery = '';
  groupForm!: FormGroup;

  filteredGroups = computed(() => {
    const q = this.searchQuery.toLowerCase();
    return !q ? this.groups() : this.groups().filter(g =>
      g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    );
  });

  availableToAdd = computed(() => {
    const group = this.selectedGroup();
    if (!group) return this.users();
    return this.users().filter(u => !group.members.includes(u.id));
  });

  constructor(
    private groupsService: GroupsService,
    private usersService: UsersService,
    private api: ApiService,
    private dialog: MatDialog,
    private snack: MatSnackBar,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.loadServers();
    this.buildForm();
  }

  loadServers() {
    this.api.get<Server[]>('/servers').subscribe(s => {
      this.servers.set(s);
      this.loadData();
    });
  }

  onServerChange(id: string) {
    this.selectedServerId.set(id);
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    const sId = this.selectedServerId() || undefined;
    this.groupsService.getAll(sId).subscribe({
      next: groups => { this.groups.set(groups); this.loading.set(false); },
      error: () => { this.groups.set([]); this.loading.set(false); }
    });
    this.usersService.getAll(sId).subscribe(users => this.users.set(users));
  }

  buildForm(group?: Group) {
    this.groupForm = this.fb.group({
      name: [group?.name || '', [Validators.required, Validators.minLength(2)]],
      description: [group?.description || ''],
      members: [group?.members || []]
    });
  }

  openForm(group?: Group) {
    this.editingGroup.set(group || null);
    this.buildForm(group);
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); this.editingGroup.set(null); }

  saveGroup() {
    if (this.groupForm.invalid) return;
    this.saving.set(true);
    const data = this.groupForm.value;
    const op = this.editingGroup()
      ? this.groupsService.update(this.editingGroup()!.id, data)
      : this.groupsService.create(data);

    op.subscribe({
      next: () => {
        this.snack.open(this.editingGroup() ? 'Grupo atualizado!' : 'Grupo criado!', 'OK', { duration: 3000 });
        this.saving.set(false);
        this.closeForm();
        this.loadData();
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erro ao salvar', 'OK', { duration: 4000 });
        this.saving.set(false);
      }
    });
  }

  deleteGroup(group: Group) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remover Grupo',
        message: `Remover o grupo "${group.name}"? Todas as permissões associadas também serão removidas.`,
        confirmLabel: 'Remover',
        danger: true,
        icon: 'group_remove'
      }
    });
    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.groupsService.delete(group.id).subscribe({
        next: () => { this.snack.open('Grupo removido', 'OK', { duration: 3000 }); this.loadData(); },
        error: () => this.snack.open('Erro ao remover', 'OK', { duration: 3000 })
      });
    });
  }

  openAddMember(group: Group) {
    this.selectedGroup.set(group);
    this.selectedUserId = '';
    this.showAddMember.set(true);
  }

  addMember() {
    if (!this.selectedUserId || !this.selectedGroup()) return;
    this.groupsService.addMember(this.selectedGroup()!.id, this.selectedUserId).subscribe({
      next: () => {
        this.snack.open('Membro adicionado!', 'OK', { duration: 3000 });
        this.showAddMember.set(false);
        this.loadData();
      },
      error: () => this.snack.open('Erro ao adicionar', 'OK', { duration: 3000 })
    });
  }

  removeMember(group: Group, userId: string) {
    this.groupsService.removeMember(group.id, userId).subscribe({
      next: () => { this.snack.open('Membro removido', 'OK', { duration: 3000 }); this.loadData(); },
      error: () => this.snack.open('Erro ao remover', 'OK', { duration: 3000 })
    });
  }
}
