import { Component, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

const ROUTE_LABELS: Record<string, { label: string; icon: string }> = {
  '/dashboard': { label: 'Dashboard', icon: 'dashboard' },
  '/users': { label: 'Usuários', icon: 'group' },
  '/groups': { label: 'Grupos', icon: 'workspaces' },
  '/folders': { label: 'Pastas & Permissões', icon: 'folder_special' },
};

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule, CommonModule],
  template: `
    <header class="header">
      <div class="header-left">
        <div class="breadcrumb">
          <mat-icon class="breadcrumb-icon">{{ currentRoute().icon }}</mat-icon>
          <span class="breadcrumb-label">{{ currentRoute().label }}</span>
        </div>
      </div>
      <div class="header-right">
        @if (auth.currentUser()) {
          <div class="status-pill auth-on">
            <span class="status-dot"></span>
            <span>Autenticado como {{ getUserName() }}</span>
          </div>
        } @else {
          <div class="status-pill auth-off">
            <span class="status-dot"></span>
            <span>Auth desativada</span>
          </div>
        }
        <button mat-icon-button matTooltip="API Health" (click)="checkHealth()">
          <mat-icon [class.healthy]="apiHealthy()">{{ apiHealthy() ? 'wifi' : 'wifi_off' }}</mat-icon>
        </button>
        <div class="user-avatar" [matTooltip]="auth.currentUser() ? 'Usuário do Portal' : 'Administrador (bypass)'">
          <mat-icon>manage_accounts</mat-icon>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: 60px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; }
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .breadcrumb-icon { color: var(--accent-color); font-size: 22px; }
    .breadcrumb-label {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      background: rgba(234, 179, 8, 0.1);
      color: #eab308;
      border: 1px solid rgba(234, 179, 8, 0.2);
    }
    .status-pill.auth-on {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      border-color: rgba(34, 197, 94, 0.2);
    }
    .status-pill.auth-on .status-dot {
      background: #22c55e;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #eab308;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .healthy { color: #22c55e !important; }
    .user-avatar {
      width: 36px;
      height: 36px;
      background: var(--accent-gradient);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .user-avatar mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
  `]
})
export class HeaderComponent {
  currentRoute = signal({ label: 'Dashboard', icon: 'dashboard' });
  apiHealthy = signal(false);

  constructor(private router: Router, public auth: AuthService) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const found = ROUTE_LABELS[e.urlAfterRedirects] || ROUTE_LABELS[e.url];
        if (found) this.currentRoute.set(found);
      });
    this.checkHealth();
  }

  getUserName(): string {
    // 1. Tenta pegar do currentUser retornado pela API (/api/auth/me)
    const currentUser = this.auth.currentUser() as any;
    
    if (currentUser?.name) return currentUser.name;
    if (currentUser?.nome) return currentUser.nome;
    if (currentUser?.username) return currentUser.username;
    
    // 2. Se a API de autenticação realmente só retornar o e-mail,
    // usamos nossa função de formatação do e-mail
    if (currentUser?.email) return this.formatEmailToName(currentUser.email);
    
    // 3. Fallback final
    return 'Usuário';
  }

  formatEmailToName(email: string): string {
    if (!email) return 'Usuário';
    const namePart = email.split('@')[0];
    const words = namePart.split(/[\.\-_]/);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  checkHealth() {
    fetch('http://192.168.13.141:3010/api/health')
      .then(r => this.apiHealthy.set(r.ok))
      .catch(() => this.apiHealthy.set(false));
  }
}
