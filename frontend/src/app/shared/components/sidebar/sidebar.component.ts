import { Component, OnInit, signal, inject, DOCUMENT } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule, CommonModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">
      <div class="sidebar-logo" (click)="toggleCollapse()">
        <div class="logo-icon">
          <img src="icone.png" alt="logo" style="width: 24px; height: 24px; object-fit: contain;">
        </div>
        @if (!collapsed()) {
          <div class="logo-text">
            <span class="logo-title">Doce Manager</span>
            <span class="logo-sub">Gerenciador</span>
          </div>
        }
        <button class="collapse-btn" [matTooltip]="collapsed() ? 'Expandir' : 'Recolher'">
          <mat-icon>{{ collapsed() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
        </button>
      </div>

      <nav class="sidebar-nav">
        @for (item of navItems; track item.route) {
          <a
            class="nav-item"
            [routerLink]="item.route"
            routerLinkActive="active"
            [matTooltip]="collapsed() ? item.label : ''"
            matTooltipPosition="right"
          >
            <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
            @if (!collapsed()) {
              <span class="nav-label">{{ item.label }}</span>
            }
            <div class="nav-indicator"></div>
          </a>
        }
      </nav>

      <div class="sidebar-footer">
        <button
          class="theme-toggle-btn"
          (click)="toggleTheme()"
          [matTooltip]="collapsed() ? (isLight() ? 'Tema Escuro' : 'Tema Claro') : ''"
          matTooltipPosition="right"
        >
          <mat-icon>{{ isLight() ? 'dark_mode' : 'light_mode' }}</mat-icon>
          @if (!collapsed()) {
            <span>{{ isLight() ? 'Tema Escuro' : 'Tema Claro' }}</span>
          }
        </button>

        <div class="version-badge">
          @if (!collapsed()) { <span>v1.0.0</span> }
          <mat-icon class="version-icon" [matTooltip]="collapsed() ? 'v1.0.0' : ''">info</mat-icon>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      min-width: 240px;
      height: 100vh;
      background: var(--bg-surface);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }
    .sidebar.collapsed {
      width: 68px;
      min-width: 68px;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
      user-select: none;
      position: relative;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      min-width: 36px;
      background: var(--accent-gradient);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px var(--accent-glow);
    }
    .logo-text { flex: 1; min-width: 0; }
    .logo-title {
      display: block;
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
    }
    .logo-sub {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .collapse-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      margin-left: auto;
    }
    .collapse-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

    .sidebar-nav {
      flex: 1;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      text-decoration: none;
      color: var(--text-secondary);
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      position: relative;
      cursor: pointer;
      white-space: nowrap;
    }
    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      transform: translateX(2px);
    }
    .nav-item.active {
      background: var(--accent-bg);
      color: var(--accent-color);
    }
    .nav-item.active .nav-indicator {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 60%;
      background: var(--accent-color);
      border-radius: 3px 0 0 3px;
    }
    .nav-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .nav-label { flex: 1; }

    .sidebar-footer {
      padding: 12px 10px;
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .theme-toggle-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      border: none;
      border-radius: 10px;
      background: var(--bg-hover);
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      font-family: 'Inter', sans-serif;
    }
    .theme-toggle-btn:hover {
      background: var(--accent-bg);
      color: var(--accent-color);
    }
    .theme-toggle-btn mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    .version-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      color: var(--text-muted);
      font-size: 12px;
    }
    .version-icon { font-size: 14px; width: 14px; height: 14px; }
  `]
})
export class SidebarComponent implements OnInit {
  private doc = inject(DOCUMENT);

  collapsed = signal(false);
  isLight = signal(false);

  navItems: NavItem[] = [
    { icon: 'dns', label: 'Servidores', route: '/servers' },
    { icon: 'group', label: 'Usuários', route: '/users' },
    { icon: 'folder_special', label: 'Pastas e Permissões', route: '/folders' },
  ];

  ngOnInit() {
    // Restaura tema salvo
    const saved = localStorage.getItem('dc-theme');
    if (saved === 'light') {
      this.applyTheme(true);
    }
  }

  toggleCollapse() {
    this.collapsed.update(v => !v);
  }

  toggleTheme() {
    this.applyTheme(!this.isLight());
  }

  private applyTheme(light: boolean) {
    this.isLight.set(light);
    const html = this.doc.documentElement;
    if (light) {
      html.setAttribute('data-theme', 'light');
      localStorage.setItem('dc-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
      localStorage.setItem('dc-theme', 'dark');
    }
  }
}
