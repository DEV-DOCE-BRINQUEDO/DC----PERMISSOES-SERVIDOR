import { Component, OnInit, signal, effect, HostListener } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FoldersService } from '../../core/services/folders.service';
import { UsersService } from '../../core/services/users.service';
import { GroupsService } from '../../core/services/groups.service';
import { ServersService } from '../../core/services/servers.service';
import { ExportService } from '../../core/services/export.service';
import { Folder, FolderNode, Permission, User, Group, Server } from '../../core/models/models';

interface GraphNode {
  id: string;
  type: 'folder' | 'user' | 'group';
  data: any; // Folder or Permission
  x: number;
  y: number;
  parentId: string | null;
  expandedFolders: boolean;
  expandedPerms: boolean;
  level: number;
}

interface GraphLink {
  sourceId: string;
  targetId: string;
  path: string;
}

@Component({
  selector: 'app-folders',
  standalone: true,
  imports: [
    CommonModule, NgTemplateOutlet, FormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule, MatInputModule
  ],
  template: `
    <div class="folders-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Pastas e Permissoes</h1>
          <p class="page-subtitle">Visualizacao de acesso as pastas por servidor</p>
        </div>
      </div>

      <div class="toolbar">
        <div class="server-select-wrap">
          <label class="server-label">Servidor</label>
          <select class="server-select-native" (change)="onNativeServerChange($event)">
            @for (srv of allServers(); track srv.id) {
              <option [value]="srv.id" [selected]="srv.id === selectedServerId()">{{ srv.name }} ({{ srv.ip }})</option>
            }
          </select>
        </div>

        <div class="toolbar-actions" *ngIf="selectedServerId()">
          <button mat-button class="export-btn pdf-btn" (click)="exportPDF()">
            <mat-icon>picture_as_pdf</mat-icon> PDF
          </button>
          <button mat-button class="export-btn xls-btn" (click)="exportXLSX()">
            <mat-icon>table_chart</mat-icon> Excel
          </button>
          
          <div class="view-toggle">
            <button [class.active]="viewMode() === 'tree'" (click)="setViewMode('tree')">
              <mat-icon>account_tree</mat-icon>
              <span>Árvore</span>
            </button>
            <button [class.active]="viewMode() === 'node'" (click)="setViewMode('node')">
              <mat-icon>hub</mat-icon>
              <span>Nós (N8N)</span>
            </button>
          </div>
        </div>
      </div>

      <div class="workspace" [class.node-active]="viewMode() === 'node'">
        <!-- Tree Panel (Only in Tree Mode) -->
        <div class="tree-panel card" *ngIf="viewMode() === 'tree'">
          <div class="panel-header">
            <mat-icon>account_tree</mat-icon>
            <span>Estrutura de Diretorios</span>
          </div>
          
          @if (!selectedServerId()) {
            <div class="no-selection">
              <mat-icon>dns</mat-icon>
              <h3>Nenhum servidor selecionado</h3>
              <p>Selecione um servidor no topo para ver suas pastas.</p>
            </div>
          } @else if (loading()) {
            @for (i of [1,2,3,4,5]; track i) {
              <div class="skeleton-row" [style.margin-left]="(i % 3) * 12 + 'px'"></div>
            }
          } @else {
            <div class="tree-root">
              @for (node of folderTree(); track node.id) {
                <ng-container *ngTemplateOutlet="treeNode; context: { node: node, depth: 0 }"></ng-container>
              }
              @if (folderTree().length === 0) {
                <div class="no-selection">
                  <p>Nenhuma pasta cadastrada neste servidor.</p>
                </div>
              }
            </div>
          }
        </div>

        <!-- Permissions Panel (Only in Tree Mode) -->
        <div class="perms-panel card" [class.active]="selectedFolder()" *ngIf="viewMode() === 'tree'">
          @if (!selectedFolder()) {
            <div class="no-selection">
              <mat-icon>touch_app</mat-icon>
              <h3>Selecione uma pasta</h3>
              <p>Clique em uma pasta na arvore para ver as permissoes configuradas.</p>
            </div>
          } @else {
            <div class="panel-header">
              <mat-icon>folder_special</mat-icon>
              <div class="folder-path-info">
                <span class="folder-path-label">Permissoes de:</span>
                <code class="folder-path">{{ selectedFolder()!.path || '/' }}</code>
              </div>
              <button mat-icon-button matTooltip="Fechar" (click)="selectedFolder.set(null)">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            @if (loadingPerms()) {
              <div class="perms-loading">
                @for (i of [1,2,3]; track i) { <div class="skeleton-perm"></div> }
              </div>
            } @else {
              <div class="perms-list">
                @for (perm of folderPerms(); track perm.id) {
                  <div class="perm-card">
                    <div class="perm-target-info">
                      <div class="perm-type-badge" [class.group]="perm.type === 'group'">
                        <mat-icon>{{ perm.type === 'user' ? 'person' : 'workspaces' }}</mat-icon>
                        {{ perm.type === 'user' ? 'Usuario' : 'Grupo' }}
                      </div>
                      <span class="perm-target-name">{{ perm.targetName }}</span>
                    </div>
                    <div class="perm-toggles">
                      <div class="toggle-wrap" [class.on]="perm.read">
                        <mat-icon>visibility</mat-icon>
                        <span>Leitura</span>
                        <div class="toggle-indicator" [class.on]="perm.read">
                          {{ perm.read ? 'ON' : 'OFF' }}
                        </div>
                      </div>
                      <div class="toggle-wrap" [class.on]="perm.write">
                        <mat-icon>edit</mat-icon>
                        <span>Escrita</span>
                        <div class="toggle-indicator" [class.on]="perm.write">
                          {{ perm.write ? 'ON' : 'OFF' }}
                        </div>
                      </div>
                    </div>
                  </div>
                } @empty {
                  <div class="no-perms">
                    <mat-icon>lock_open</mat-icon>
                    <p>Nenhuma permissao configurada para esta pasta</p>
                  </div>
                }
              </div>
            }
          }
        </div>

        <!-- FULLSCREEN NODE VIEW PANEL -->
        <div class="node-panel card" *ngIf="viewMode() === 'node'">
          <div class="node-canvas" 
               (mousedown)="onCanvasMouseDown($event)" 
               (wheel)="onCanvasWheel($event)"
               (contextmenu)="onCanvasContextMenu($event)">
               
            <div class="node-graph-transform" 
                 [style.transform]="'translate(' + panX() + 'px, ' + panY() + 'px) scale(' + zoom() + ')'">
              
              <!-- SVG Lines -->
              <svg class="graph-lines-interactive">
                @for (link of renderedLinks(); track link.sourceId + '-' + link.targetId) {
                  <path class="graph-line" [attr.d]="link.path" />
                }
              </svg>

              <!-- HTML Nodes -->
              @for (node of renderedNodes(); track node.id) {
                <div class="graph-node interactive-node" 
                     [class.folder-node]="node.type === 'folder'"
                     [class.perm-node]="node.type === 'user'"
                     [class.group-node]="node.type === 'group'"
                     [style.transform]="'translate(' + node.x + 'px, ' + node.y + 'px)'"
                     (contextmenu)="onNodeContextMenu($event, node)">
                     
                  <div class="connector left" *ngIf="node.parentId"></div>
                  
                  <mat-icon>{{ node.type === 'folder' ? 'folder_special' : (node.type === 'user' ? 'person' : 'workspaces') }}</mat-icon>
                  
                  <div class="node-content">
                    <span class="node-type">
                      {{ node.type === 'folder' ? 'Pasta' : (node.type === 'user' ? 'Usuário' : 'Grupo') }}
                    </span>
                    <span class="node-name">
                      {{ node.type === 'folder' ? node.data.name : node.data.targetName }}
                    </span>
                    
                    @if (node.type === 'folder') {
                      <span class="node-path">{{ node.data.path || '/' }}</span>
                    } @else {
                      <div class="node-rights">
                        <span class="badge" [class.active]="node.data.read">R</span>
                        <span class="badge" [class.active]="node.data.write">W</span>
                      </div>
                    }
                  </div>
                  
                  <div class="connector right" *ngIf="node.type === 'folder'"></div>
                </div>
              }
              
            </div>
            
            <!-- Zoom Controls Overlay -->
            <div class="zoom-controls">
              <button mat-icon-button matTooltip="Resetar" (click)="resetView()"><mat-icon>filter_center_focus</mat-icon></button>
              <button mat-icon-button (click)="zoom.set(zoom() + 0.2)"><mat-icon>add</mat-icon></button>
              <button mat-icon-button (click)="zoom.set(zoom() - 0.2)"><mat-icon>remove</mat-icon></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tree node template (for Tree Mode) -->
      <ng-template #treeNode let-node="node" let-depth="depth">
        <div class="tree-item" [style.padding-left]="(depth * 20 + 12) + 'px'"
             [class.selected]="selectedFolder()?.id === node.id"
             (click)="selectFolder(node)">
          <mat-icon class="tree-expand-icon" (click)="toggleExpand(node, $event)">
            {{ expandedNodes().has(node.id) ? 'expand_more' : 'chevron_right' }}
          </mat-icon>
          <mat-icon class="tree-folder-icon">
            {{ selectedFolder()?.id === node.id ? 'folder_open' : 'folder' }}
          </mat-icon>
          <span class="tree-label">{{ node.name }}</span>
          @if (getPermCount(node.path) > 0) {
            <span class="perm-count">{{ getPermCount(node.path) }}</span>
          }
        </div>
        @if (expandedNodes().has(node.id) && node.children?.length > 0) {
          @for (child of node.children; track child.id) {
            <ng-container *ngTemplateOutlet="treeNode; context: { node: child, depth: depth + 1 }"></ng-container>
          }
        }
      </ng-template>

      <!-- Context Menu -->
      <div class="context-menu" 
           *ngIf="contextMenuOpen()"
           [style.left.px]="contextMenuX()"
           [style.top.px]="contextMenuY()">
        <div class="cm-header">Opções de {{ contextMenuNode()?.type === 'folder' ? 'Pasta' : 'Acesso' }}</div>
        
        @if (contextMenuNode()?.type === 'folder') {
          @if (contextMenuNode()?.level === 0) {
            <button class="cm-btn" (click)="expandAllBranches(contextMenuNode()!)">
              <mat-icon>account_tree</mat-icon> Abrir toda ramificação
            </button>
          }
          <button class="cm-btn" (click)="expandSubfolders(contextMenuNode()!)">
            <mat-icon>account_tree</mat-icon> Ver Subpastas
          </button>
          <button class="cm-btn" (click)="expandPermissions(contextMenuNode()!)">
            <mat-icon>admin_panel_settings</mat-icon> Ver Permissões
          </button>
          
          @if (contextMenuNode()?.expandedPerms) {
            <button class="cm-btn" (click)="collapsePermissions(contextMenuNode()!)">
              <mat-icon>security</mat-icon> Recolher Permissões
            </button>
          }
          
          @if (contextMenuNode()?.expandedFolders || contextMenuNode()?.expandedPerms) {
            <button class="cm-btn danger" (click)="closeBranch(contextMenuNode()!.id)">
              <mat-icon>close</mat-icon> Fechar Ramificações
            </button>
          }
        } @else {
          <div class="cm-info">Sem opções adicionais para este nó.</div>
        }
      </div>

    </div>
  `,
  styles: [`
    .folders-page { display: flex; flex-direction: column; gap: 20px; position: relative; height: 100vh; overflow: hidden; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-shrink: 0; }
    .page-title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px; }
    .page-subtitle { color: var(--text-muted); font-size: 14px; margin: 0; }

    .toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: space-between;
    }
    .toolbar-actions { display: flex; gap: 16px; align-items: center; }

    .workspace {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 20px;
      flex: 1;
      height: 0; /* allows flex-1 to scroll */
      min-height: 0;
    }
    .workspace.node-active {
      grid-template-columns: 1fr;
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 16px 12px;
      border-bottom: 1px solid var(--border-color);
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .panel-header mat-icon { color: var(--accent-color); }

    /* Tree */
    .tree-panel { overflow-y: auto; }
    .skeleton-row {
      height: 32px; background: var(--bg-hover); border-radius: 8px;
      margin: 4px 12px; animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
    .tree-root { padding: 8px 0; }
    .tree-item {
      display: flex; align-items: center; gap: 8px; padding: 6px 12px;
      cursor: pointer; border-radius: 0 16px 16px 0; margin-right: 12px;
      color: var(--text-secondary); transition: all 0.2s;
    }
    .tree-item:hover { background: var(--bg-hover); color: var(--text-primary); }
    .tree-item.selected { background: rgba(59,130,246,0.1); color: var(--accent-color); font-weight: 500; }
    .tree-expand-icon { font-size: 20px; width: 20px; height: 20px; color: var(--text-muted); }
    .tree-folder-icon { font-size: 18px; width: 18px; height: 18px; }
    .tree-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px; }
    .perm-count { font-size: 11px; background: var(--bg-hover); padding: 2px 6px; border-radius: 12px; color: var(--text-muted); }
    .no-selection { padding: 40px 20px; text-align: center; color: var(--text-muted); }
    .no-selection mat-icon { font-size: 48px; width: 48px; height: 48px; opacity: 0.5; margin-bottom: 16px; }

    /* Perms Panel */
    .perms-panel { overflow-y: auto; }
    .folder-path-info { display: flex; flex-direction: column; flex: 1; }
    .folder-path-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
    .folder-path { font-size: 13px; color: var(--text-primary); word-break: break-all; }
    .perms-loading { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .skeleton-perm { height: 70px; background: var(--bg-hover); border-radius: 12px; animation: shimmer 1.5s infinite; }
    .perms-list { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .perm-card { background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; transition: transform 0.2s; }
    .perm-card:hover { transform: translateY(-2px); border-color: var(--text-muted); }
    .perm-target-info { display: flex; flex-direction: column; gap: 6px; }
    .perm-type-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #10b981; }
    .perm-type-badge.group { color: #f59e0b; }
    .perm-type-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .perm-target-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .perm-toggles { display: flex; gap: 16px; }
    .toggle-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--text-muted); font-size: 11px; }
    .toggle-wrap mat-icon { font-size: 20px; width: 20px; height: 20px; opacity: 0.5; }
    .toggle-wrap.on mat-icon { opacity: 1; color: var(--text-primary); }
    .toggle-indicator { padding: 2px 8px; border-radius: 12px; font-weight: 700; background: var(--bg-hover); }
    .toggle-indicator.on { background: rgba(59,130,246,0.1); color: var(--accent-color); }
    .no-perms { text-align: center; padding: 60px 20px; color: var(--text-muted); }
    .no-perms mat-icon { font-size: 36px; width: 36px; height: 36px; opacity: 0.3; }

    /* Buttons */
    .view-toggle {
      display: flex;
      background: var(--bg-hover);
      border-radius: 10px;
      padding: 4px;
      gap: 2px;
      border: 1px solid var(--border-color);
    }
    .view-toggle button {
      background: none; border: none;
      padding: 7px 14px;
      color: var(--text-secondary);
      border-radius: 7px; cursor: pointer;
      font-weight: 600; font-size: 13px;
      transition: all 0.2s;
      display: flex; align-items: center; gap: 6px;
      white-space: nowrap;
    }
    .view-toggle button mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .view-toggle button:hover { color: var(--text-primary); background: var(--bg-surface); }
    .view-toggle button.active {
      background: var(--accent-gradient);
      color: #fff;
      box-shadow: 0 2px 10px var(--accent-glow);
    }
    .view-toggle button.active mat-icon { color: #fff; }

    .export-btn {
      color: var(--text-primary) !important;
      background: var(--bg-surface) !important;
      border-radius: 8px !important;
      border: 1px solid var(--border-color) !important;
      font-weight: 600 !important;
      font-size: 13px !important;
      height: 38px;
      padding: 0 14px !important;
      min-width: unset !important;
      display: flex !important;
      align-items: center !important;
    }
    .pdf-btn mat-icon { color: #ef4444 !important; margin-right: 5px; }
    .xls-btn mat-icon { color: #22c55e !important; margin-right: 5px; }
    .export-btn:hover { border-color: var(--accent-color) !important; }

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

    /* Node View Interativo */
    .node-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
    .node-canvas {
      flex: 1; position: absolute; inset: 0;
      background-color: var(--bg-primary);
      background-image: radial-gradient(var(--border-color) 1px, transparent 0);
      background-size: 40px 40px;
      cursor: grab;
      overflow: hidden;
    }
    .node-canvas:active { cursor: grabbing; }
    
    .node-graph-transform {
      position: absolute; top: 0; left: 0; width: 0; height: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
    
    .interactive-node {
      position: absolute; top: 0; left: 0;
    }

    .graph-node {
      background: var(--bg-surface);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 0 16px;
      display: flex; align-items: center; gap: 16px;
      width: 280px; height: 80px; box-sizing: border-box;
      box-shadow: var(--shadow-md);
      transition: border-color 0.2s, box-shadow 0.2s;
      z-index: 2;
      cursor: pointer;
    }
    .graph-node:hover { border-color: var(--accent-color); box-shadow: 0 8px 32px var(--accent-glow); }
    .folder-node { border-left: 4px solid #6366f1; width: 320px; }
    .perm-node { border-left: 4px solid #10b981; }
    .group-node { border-left: 4px solid #f59e0b; }
    
    .graph-node mat-icon {
      font-size: 28px; width: 28px; height: 28px;
      background: var(--accent-bg); border-radius: 8px; padding: 8px;
      color: var(--text-secondary);
    }
    .folder-node mat-icon { color: #6366f1; background: rgba(99,102,241,0.12); }
    .perm-node mat-icon { color: #10b981; background: rgba(16,185,129,0.12); }
    .group-node mat-icon { color: #f59e0b; background: rgba(245,158,11,0.12); }
    
    .node-content { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
    .node-type { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700; margin-bottom: 3px; }
    .node-name { font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .node-path { font-size: 11px; color: var(--text-secondary); margin-top: 3px; word-break: break-all; }
    
    .node-rights { display: flex; gap: 6px; margin-top: 8px; }
    .badge {
      font-size: 10px; font-weight: 700; padding: 2px 8px;
      border-radius: 4px; background: var(--bg-hover); color: var(--text-muted);
    }
    .badge.active { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    
    .connector {
      position: absolute; width: 14px; height: 14px;
      background: var(--bg-surface); border: 3px solid var(--border-color);
      border-radius: 50%; top: 50%; transform: translateY(-50%);
      transition: all 0.2s;
    }
    .connector.right { right: -8px; }
    .connector.left { left: -8px; }
    .graph-node:hover .connector { border-color: var(--accent-color); background: var(--accent-color); }

    .graph-lines-interactive {
      position: absolute; top: 0; left: 0; width: 1px; height: 1px;
      overflow: visible; pointer-events: none; z-index: 1;
    }
    .graph-line {
      fill: none; stroke: var(--border-color); stroke-width: 2px;
      opacity: 0.7;
    }

    .zoom-controls {
      position: absolute; bottom: 20px; right: 20px;
      display: flex; gap: 8px; background: var(--bg-surface);
      padding: 8px; border-radius: 12px; border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10;
    }

    /* Context Menu */
    .context-menu {
      position: fixed; background: var(--bg-surface);
      border: 1px solid var(--border-color); border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5); padding: 8px;
      min-width: 220px; z-index: 1000;
      display: flex; flex-direction: column; gap: 4px;
    }
    .cm-header {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
      color: var(--text-muted); padding: 8px 12px; font-weight: 700;
    }
    .cm-btn {
      background: none; border: none; text-align: left;
      padding: 10px 12px; border-radius: 8px; color: var(--text-primary);
      cursor: pointer; display: flex; align-items: center; gap: 10px;
      font-size: 14px; transition: background 0.2s;
    }
    .cm-btn mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--text-secondary); }
    .cm-btn:hover { background: var(--bg-hover); }
    .cm-btn.danger { color: #ef4444; margin-top: 8px; border-top: 1px solid var(--border-color); border-radius: 0 0 8px 8px; }
    .cm-btn.danger mat-icon { color: #ef4444; }
    .cm-btn.danger:hover { background: rgba(239, 68, 68, 0.1); }
    .cm-info { padding: 12px; font-size: 13px; color: var(--text-muted); font-style: italic; }
  `]
})
export class FoldersComponent implements OnInit {
  viewMode = signal<'tree' | 'node'>('tree');
  allServers = signal<Server[]>([]);
  selectedServerId = signal<string | null>(null);
  
  folderTree = signal<FolderNode[]>([]);
  allFolders = signal<Folder[]>([]);
  allPermissions = signal<Permission[]>([]);
  folderPerms = signal<Permission[]>([]);
  
  allUsers = signal<User[]>([]);
  allGroups = signal<Group[]>([]);
  
  selectedFolder = signal<FolderNode | null>(null);
  expandedNodes = signal<Set<string>>(new Set());
  
  loading = signal(false);
  loadingPerms = signal(false);

  // --- NODE CANVAS INTERACTIVE STATE ---
  renderedNodes = signal<GraphNode[]>([]);
  renderedLinks = signal<GraphLink[]>([]);
  
  zoom = signal<number>(1);
  panX = signal<number>(50);
  panY = signal<number>(100);
  isDragging = false;
  dragStartX = 0;
  dragStartY = 0;

  contextMenuOpen = signal<boolean>(false);
  contextMenuX = signal<number>(0);
  contextMenuY = signal<number>(0);
  contextMenuNode = signal<GraphNode | null>(null);

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

  constructor(
    private foldersService: FoldersService,
    private usersService: UsersService,
    private groupsService: GroupsService,
    private serversService: ServersService,
    private exportService: ExportService
  ) {
    effect(() => {
      const sId = this.selectedServerId();
      if (sId) {
        this.loadFolders(sId);
      } else {
        this.folderTree.set([]);
        this.allFolders.set([]);
        this.allPermissions.set([]);
        this.selectedFolder.set(null);
        this.renderedNodes.set([]);
        this.renderedLinks.set([]);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.loadGlobalData();
  }

  loadGlobalData() {
    this.serversService.getAll().subscribe(servers => {
      this.allServers.set(servers);
      if (servers.length > 0 && !this.selectedServerId()) {
        this.selectedServerId.set(servers[0].id);
      }
    });
    this.usersService.getAll().subscribe(u => this.allUsers.set(u));
    this.groupsService.getAll().subscribe(g => this.allGroups.set(g));
  }

  onServerChange(serverId: string) {
    this.selectedServerId.set(serverId);
  }

  onNativeServerChange(event: Event) {
    const sel = event.target as HTMLSelectElement;
    if (sel?.value) this.selectedServerId.set(sel.value);
  }

  loadFolders(serverId: string) {
    this.loading.set(true);
    this.foldersService.getAll(serverId).subscribe({
      next: ({ folders, tree }) => {
        this.allFolders.set(folders);
        this.folderTree.set(tree);
        const expanded = new Set<string>(tree.map(n => n.id));
        this.expandedNodes.set(expanded);
        this.loading.set(false);
        
        // Re-init canvas if in node mode
        if (this.viewMode() === 'node') {
          this.initNodeCanvas();
        }
      },
      error: () => this.loading.set(false)
    });
    
    this.foldersService.getAllPermissions(serverId).subscribe(p => this.allPermissions.set(p));
    this.selectedFolder.set(null);
  }

  setViewMode(mode: 'tree' | 'node') {
    this.viewMode.set(mode);
    if (mode === 'node') {
      this.initNodeCanvas();
    }
  }

  // --- TREE LOGIC ---
  selectFolder(node: FolderNode) {
    this.selectedFolder.set(node);
    this.loadingPerms.set(true);
    
    if (!this.expandedNodes().has(node.id)) {
      this.toggleExpand(node, new Event('click'));
    }

    const sId = this.selectedServerId();
    if (!sId) return;

    this.foldersService.getPermissionsByPath(node.path, sId).subscribe({
      next: p => { 
        this.folderPerms.set(p.filter(perm => !this.isIgnored(perm.targetName)));
        this.loadingPerms.set(false); 
      },
      error: () => this.loadingPerms.set(false)
    });
  }

  toggleExpand(node: FolderNode, event: Event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const set = new Set(this.expandedNodes());
    if (set.has(node.id)) {
      set.delete(node.id);
      this.expandedNodes.set(set);
    } else {
      set.add(node.id);
      this.expandedNodes.set(set);
      if (!node.children || node.children.length === 0) {
        const sId = this.selectedServerId();
        if (sId) {
          this.foldersService.getChildren(sId, node.path).subscribe({
            next: ({ tree }) => {
              node.children = tree;
              this.folderTree.set([...this.folderTree()]);
            }
          });
        }
      }
    }
  }

  getPermCount(path: string): number {
    return this.allPermissions().filter(p => p.path === path).length;
  }

  exportPDF() {
    const srv = this.allServers().find(s => s.id === this.selectedServerId());
    this.exportService.exportPermissionsToPDF(this.allFolders(), this.allPermissions(), srv?.name || 'Desconhecido');
  }

  exportXLSX() {
    const srv = this.allServers().find(s => s.id === this.selectedServerId());
    this.exportService.exportPermissionsToXLSX(this.allFolders(), this.allPermissions(), srv?.name || 'Desconhecido');
  }

  // --- INTERACTIVE CANVAS LOGIC ---

  initNodeCanvas() {
    const tree = this.folderTree();
    if (tree.length > 0) {
      const rootFolder = tree[0]; 
      this.renderedNodes.set([{
        id: rootFolder.id,
        type: 'folder',
        data: rootFolder,
        x: 0, y: 0,
        parentId: null,
        expandedFolders: false,
        expandedPerms: false,
        level: 0
      }]);
      this.updateNodeLayout();
      this.resetView();
    } else {
      this.renderedNodes.set([]);
      this.renderedLinks.set([]);
    }
  }

  resetView() {
    this.zoom.set(1);
    this.panX.set(100);
    
    // Attempt to center vertically based on window size
    const vh = window.innerHeight;
    this.panY.set(vh / 2 - 160); // approximate center
  }

  // Zoom & Pan Events
  onCanvasContextMenu(event: MouseEvent) {
    event.preventDefault(); // Impede o menu padrao do navegador
  }

  onCanvasMouseDown(event: MouseEvent) {
    // Apenas permite arrastar se for o botao esquerdo (0)
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.graph-node')) return;
    
    this.isDragging = true;
    this.dragStartX = event.clientX - this.panX();
    this.dragStartY = event.clientY - this.panY();
  }
  
  @HostListener('window:mousemove', ['$event'])
  onCanvasMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    this.panX.set(event.clientX - this.dragStartX);
    this.panY.set(event.clientY - this.dragStartY);
  }
  
  @HostListener('window:mouseup')
  onCanvasMouseUp() {
    this.isDragging = false;
  }
  
  onCanvasWheel(event: WheelEvent) {
    const canvasElement = (event.target as HTMLElement).closest('.node-canvas');
    if (!canvasElement) return;
    
    // Evitar scroll da pagina
    event.preventDefault();
    
    const rect = canvasElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const currentZoom = this.zoom();
    const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.2, Math.min(3, currentZoom + zoomDelta));
    
    if (newZoom === currentZoom) return;

    // Calcular posicao do mouse no canvas original
    const mouseXCanvas = (mouseX - this.panX()) / currentZoom;
    const mouseYCanvas = (mouseY - this.panY()) / currentZoom;

    // Ajustar o Pan para que o mouse aponte para o mesmo lugar
    const newPanX = mouseX - mouseXCanvas * newZoom;
    const newPanY = mouseY - mouseYCanvas * newZoom;

    this.zoom.set(newZoom);
    this.panX.set(newPanX);
    this.panY.set(newPanY);
  }

  // Context Menu
  onNodeContextMenu(event: MouseEvent, node: GraphNode) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuX.set(event.clientX);
    this.contextMenuY.set(event.clientY);
    this.contextMenuNode.set(node);
    this.contextMenuOpen.set(true);
  }
  
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.context-menu') && !target.closest('.graph-node')) {
      this.contextMenuOpen.set(false);
    }
  }

  // Node Actions
  expandSubfolders(node: GraphNode) {
    this.contextMenuOpen.set(false);
    const oldY = node.y;

    this.closeSiblings(node);
    
    node.expandedFolders = true;
    const subfolders = this.allFolders().filter(f => f.parentPath === node.data.path);
    
    if (subfolders.length > 0) {
      const newNodes = subfolders.map(f => ({
        id: f.id,
        type: 'folder' as const,
        data: f,
        x: 0, y: 0,
        parentId: node.id,
        expandedFolders: false,
        expandedPerms: false,
        level: node.level + 1
      }));
      
      this.renderedNodes.update(n => {
        const filtered = n.filter(x => x.parentId !== node.id || x.type !== 'folder');
        return [...filtered, ...newNodes];
      });
    }
    
    this.updateNodeLayout();
    const newY = node.y;
    
    // Ajusta o Pan para manter o nó na mesma posicao da tela
    this.panY.set(this.panY() - (newY - oldY) * this.zoom());
  }
  
  expandAllBranches(node: GraphNode) {
    this.contextMenuOpen.set(false);
    const oldY = node.y;
    // Para abrir toda ramificacao a partir do no atual (normalmente nivel 0)
    
    const all = this.allFolders();
    const nodesToAdd: GraphNode[] = [];
    
    // Funcao recursiva para varrer filhos
    const traverse = (parentId: string, parentPath: string, level: number) => {
      const subfolders = all.filter(f => f.parentPath === parentPath);
      subfolders.forEach(f => {
        nodesToAdd.push({
          id: f.id,
          type: 'folder',
          data: f,
          x: 0, y: 0,
          parentId: parentId,
          expandedFolders: true,
          expandedPerms: false,
          level: level
        });
        traverse(f.id, f.path, level + 1);
      });
    };
    
    traverse(node.id, node.data.path, node.level + 1);
    
    if (nodesToAdd.length > 0) {
      node.expandedFolders = true;
      this.renderedNodes.update(n => {
        // Limpa filhos existentes e insere a arvore completa
        const filtered = n.filter(x => x.id === node.id || x.level <= node.level);
        return [...filtered, ...nodesToAdd];
      });
    }
    
    this.updateNodeLayout();
    const newY = node.y;
    this.panY.set(this.panY() - (newY - oldY) * this.zoom());
  }
  
  expandPermissions(node: GraphNode) {
    this.contextMenuOpen.set(false);
    const oldY = node.y;
    
    this.closeSiblings(node);
    
    node.expandedPerms = true;
    const perms = this.allPermissions().filter(p => p.path === node.data.path && !this.isIgnored(p.targetName));
    
    if (perms.length > 0) {
      const newNodes = perms.map(p => ({
        id: p.id,
        type: p.type as 'user'|'group',
        data: p,
        x: 0, y: 0,
        parentId: node.id,
        expandedFolders: false,
        expandedPerms: false,
        level: node.level + 1
      }));
      
      this.renderedNodes.update(n => {
        const filtered = n.filter(x => x.parentId !== node.id || (x.type !== 'user' && x.type !== 'group'));
        return [...filtered, ...newNodes];
      });
    }
    
    this.updateNodeLayout();
    const newY = node.y;
    this.panY.set(this.panY() - (newY - oldY) * this.zoom());
  }

  collapsePermissions(node: GraphNode) {
    this.contextMenuOpen.set(false);
    node.expandedPerms = false;
    
    const oldY = node.y;
    
    this.renderedNodes.update(n => {
      // Mantem apenas quem nao e filho direto ou que e do tipo folder (remove users/groups)
      const filtered = n.filter(x => x.parentId !== node.id || x.type === 'folder');
      return [...filtered];
    });
    
    this.updateNodeLayout();
    const newY = node.y;
    this.panY.set(this.panY() - (newY - oldY) * this.zoom());
  }

  closeBranch(nodeId: string, adjustPan: boolean = true) {
    this.contextMenuOpen.set(false);
    
    const node = this.renderedNodes().find(x => x.id === nodeId);
    const oldY = node ? node.y : 0;
    
    const toRemove = new Set<string>();
    const gatherDescendants = (id: string) => {
      const children = this.renderedNodes().filter(n => n.parentId === id);
      children.forEach(c => {
        toRemove.add(c.id);
        gatherDescendants(c.id);
      });
    };
    gatherDescendants(nodeId);
    
    if (toRemove.size > 0) {
      this.renderedNodes.update(nodes => nodes.filter(n => !toRemove.has(n.id)));
    }
    
    // Reset state of the node
    this.renderedNodes.update(nodes => {
      const n = nodes.find(x => x.id === nodeId);
      if (n) { n.expandedFolders = false; n.expandedPerms = false; }
      return [...nodes];
    });
    
    this.updateNodeLayout();
    
    if (adjustPan && node) {
      const newY = node.y;
      this.panY.set(this.panY() - (newY - oldY) * this.zoom());
    }
  }

  closeSiblings(node: GraphNode) {
    const siblings = this.renderedNodes().filter(n => n.parentId === node.parentId && n.id !== node.id);
    siblings.forEach(s => this.closeBranch(s.id, false));
  }

  // Layout Algorithm
  updateNodeLayout() {
    const nodes = this.renderedNodes();
    if (nodes.length === 0) return;
    
    const root = nodes.find(n => n.level === 0);
    if (!root) return;

    let currentY = 0;
    
    // Recursive layout
    const layoutNode = (node: GraphNode): number[] => {
      const children = nodes.filter(n => n.parentId === node.id);
      
      // X Spacing: 360px per level
      node.x = node.level * 400; 
      
      if (children.length === 0) {
        node.y = currentY;
        currentY += 100; // 100px vertical spacing per leaf (80px height + 20px gap)
        return [node.y];
      } else {
        let childYs: number[] = [];
        children.forEach(c => {
          childYs.push(...layoutNode(c));
        });
        
        // Center parent relative to children boundaries
        const min = Math.min(...childYs);
        const max = Math.max(...childYs);
        node.y = (min + max) / 2;
        return childYs;
      }
    };
    
    layoutNode(root);
    
    // Force angular to trigger change detection on the signal
    this.renderedNodes.set([...nodes]);
    this.updateLinks();
  }

  updateLinks() {
    const nodes = this.renderedNodes();
    const links: GraphLink[] = [];
    
    nodes.forEach(n => {
      if (n.parentId) {
        const parent = nodes.find(p => p.id === n.parentId);
        if (parent) {
          const parentWidth = parent.type === 'folder' ? 320 : 280;
          
          // Connectors are vertically centered: y + 40
          const startX = parent.x + parentWidth;
          const startY = parent.y + 40;
          const endX = n.x;
          const endY = n.y + 40;
          
          const cp1X = startX + 60;
          const cp2X = endX - 60;
          
          const path = `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
          links.push({ sourceId: parent.id, targetId: n.id, path });
        }
      }
    });
    
    this.renderedLinks.set(links);
  }
}
