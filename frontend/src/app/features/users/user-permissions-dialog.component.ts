import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/models';

@Component({
  selector: 'app-user-permissions-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-title">
          <div class="avatar">{{ data.user.name.charAt(0).toUpperCase() }}</div>
          <div>
            <h2 mat-dialog-title>Permissoes de {{ data.user.name }}</h2>
            <p class="subtitle">{{ data.user.username }}</p>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <mat-dialog-content>
        @if (loading()) {
          <div class="loading-state">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Carregando permissoes...</p>
          </div>
        } @else {
          @if (permissions().length === 0) {
            <div class="empty-state">
              <mat-icon>folder_off</mat-icon>
              <p>Nenhuma permissao encontrada para este usuario.</p>
            </div>
          } @else {
            <div class="table-container">
              <table class="perms-table">
                <thead>
                  <tr>
                    <th>Pasta</th>
                    <th>Origem</th>
                    <th>Direitos</th>
                  </tr>
                </thead>
                <tbody>
                  @for (perm of permissions(); track perm.id) {
                    <tr>
                      <td>
                        <div class="folder-cell">
                          <mat-icon class="folder-icon">folder</mat-icon>
                          <span class="folder-name">{{ perm.folderName || shortPath(perm.path) }}</span>
                          <span class="folder-path" [title]="perm.path">{{ perm.path }}</span>
                        </div>
                      </td>
                      <td>
                        <span class="origin-badge" [class.group]="perm.type === 'group'">
                          <mat-icon>{{ perm.type === 'group' ? 'groups' : 'person' }}</mat-icon>
                          {{ perm.type === 'group' ? 'Via Grupo' : 'Direta' }}
                        </span>
                      </td>
                      <td>
                        <div class="rights-cell">
                          @if (perm.read) { <span class="badge read">Leitura</span> }
                          @if (perm.write) { <span class="badge write">Escrita</span> }
                          @if (!perm.read && !perm.write) { <span class="badge raw">{{ perm.rawRights }}</span> }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Fechar</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; max-height: 80vh; }
    .dialog-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; }
    .header-title { display: flex; align-items: center; gap: 16px; }
    .header-title h2 { margin: 0; font-size: 20px; font-weight: 700; color: var(--text-primary); }
    .subtitle { margin: 2px 0 0; font-size: 13px; color: var(--text-muted); font-family: monospace; }
    .avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 18px; }
    
    mat-dialog-content { padding: 24px !important; flex: 1; }
    
    .loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 0; color: var(--text-muted); gap: 16px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.5; }
    
    .table-container { border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; background: var(--bg-surface); }
    .perms-table { width: 100%; border-collapse: collapse; }
    .perms-table th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; background: var(--bg-hover); border-bottom: 1px solid var(--border-color); }
    .perms-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    .perms-table tr:last-child td { border-bottom: none; }
    .perms-table tr:hover td { background: var(--bg-hover); }
    
    .folder-cell { display: flex; flex-direction: column; position: relative; padding-left: 28px; }
    .folder-icon { position: absolute; left: 0; top: 0; color: #6366f1; font-size: 20px; width: 20px; height: 20px; }
    .folder-name { font-weight: 600; font-size: 14px; color: var(--text-primary); }
    .folder-path { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; word-break: break-all; line-height: 1.4; }
    
    .origin-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; background: rgba(59,130,246,0.1); color: #3b82f6; }
    .origin-badge.group { background: rgba(139,92,246,0.1); color: #8b5cf6; }
    .origin-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    
    .rights-cell { display: flex; gap: 6px; }
    .badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .badge.read { background: rgba(16,185,129,0.15); color: #10b981; }
    .badge.write { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge.raw { background: var(--bg-hover); color: var(--text-secondary); }
  `]
})
export class UserPermissionsDialogComponent implements OnInit {
  permissions = signal<any[]>([]);
  loading = signal(true);

  constructor(
    public dialogRef: MatDialogRef<UserPermissionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { user: User },
    private usersService: UsersService
  ) {}

  ngOnInit() {
    this.usersService.getPermissions(this.data.user.id).subscribe({
      next: (perms) => {
        // Remove duplicatas (um usuario pode ter permissao direta e via grupo na mesma pasta)
        // Agrupando pelo path
        const unique = perms.reduce((acc, current) => {
          const x = acc.find((item: any) => item.path === current.path);
          if (!x) {
            return acc.concat([current]);
          } else {
            // Mescla direitos se ja existe
            if (current.read) x.read = 1;
            if (current.write) x.write = 1;
            // Se uma for via grupo e outra for direta, consideramos 'direta' mais forte no UI
            if (current.type === 'user') x.type = 'user';
            return acc;
          }
        }, []);

        // Ordena por nome da pasta
        unique.sort((a: any, b: any) => (a.folderName || a.path).localeCompare(b.folderName || b.path));
        
        this.permissions.set(unique);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  shortPath(p: string): string {
    if (!p) return '';
    const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || p;
  }
}
