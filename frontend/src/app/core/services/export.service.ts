import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Permission, Folder } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ExportService {

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
    if (this.ignoreList.includes(n)) return true;
    if (n === 'administrador' || n === 'sistema' || n === 'wdagutilityaccount') return true;
    if (n.startsWith('nt authority') || n.startsWith('builtin') || n.startsWith('window manager') || n.startsWith('nt service')) return true;
    if (n.startsWith('s-1-')) return true;
    if (n.startsWith('sqlexpress')) return true;
    if (n.includes('teste') || n.includes('test')) return true;
    return false;
  }

  private ascii(str: string): string {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '?');
  }

  private shortName(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  }

  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.substring(0, maxLen - 1) + '.' : str;
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
  }

  /**
   * Matriz: Linhas = Pastas, Colunas = Usuarios
   * Cada célula: 'X' se o usuario tem acesso à pasta, '' caso contrário
   */
  private buildMatrix(permissions: Permission[]) {
    const userPaths = new Map<string, Set<string>>();
    const userDisplay = new Map<string, string>(); // armazena o nome original sem dominio

    for (const p of permissions) {
      if (p.path === '/' || p.path === '\\') continue;
      const rawName = p.targetName || 'Desconhecido';
      if (this.isIgnored(rawName)) continue;
      
      // Deduplica por nome base (sem dominio e minúsculo)
      let baseKey = rawName.toLowerCase();
      if (baseKey.includes('\\')) baseKey = baseKey.split('\\')[1];

      if (!userPaths.has(baseKey)) {
        userPaths.set(baseKey, new Set());
        // Salva a versão com a capitalização correta para exibição (removendo domínio)
        let display = rawName;
        if (display.includes('\\')) display = display.split('\\')[1];
        userDisplay.set(baseKey, display);
      }
      userPaths.get(baseKey)!.add(p.path);
    }

    // Remove subpastas redundantes por usuario
    const userTopPaths = new Map<string, Set<string>>();
    for (const [baseKey, pathSet] of userPaths) {
      const user = userDisplay.get(baseKey)!;
      const sorted = Array.from(pathSet).sort((a, b) => a.length - b.length);
      const top = new Set<string>();
      for (const p of sorted) {
        const covered = Array.from(top).some(t => p.startsWith(t + '\\') || p.startsWith(t + '/') || p === t);
        if (!covered) top.add(p);
      }
      userTopPaths.set(user, top);
    }

    // Pastas e usuarios ordenados
    const allFolders = new Set<string>();
    for (const paths of userTopPaths.values()) paths.forEach(p => allFolders.add(p));
    const folderList = Array.from(allFolders).sort((a, b) => this.shortName(a).localeCompare(this.shortName(b), undefined, { sensitivity: 'base' }));
    const userList = Array.from(userTopPaths.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return { userList, folderList, userTopPaths };
  }

  exportPermissionsToPDF(folders: Folder[], permissions: Permission[], serverName: string) {
    const data = this.buildMatrix(permissions);

    if (data.userList.length === 0 || data.folderList.length === 0) {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(12);
      doc.text('Nenhuma permissao encontrada.', 14, 30);
      this.downloadBlob(doc.output('blob'), `Permissoes_${this.ascii(serverName)}.pdf`);
      return;
    }

    // ── Configuração de layout ──────────────────────────────────────────────
    // A4 Landscape: 297 x 210mm  |  Portrait: 210 x 297mm
    // Escolhemos Landscape para maximizar colunas de usuarios
    const orientation = 'landscape';
    const pageW = 297;
    const pageH = 210;
    const mL = 8;
    const mR = 8;
    const headerH = 12;  // altura do cabeçalho colorido no topo
    const usableW = pageW - mL - mR;

    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    let maxFolderW = 20;
    for (const folder of data.folderList) {
      const folderLabel = this.ascii(this.shortName(folder));
      const w = doc.getTextWidth(folderLabel);
      if (w > maxFolderW) maxFolderW = w;
    }

    // Coluna de pasta: reajusta de acordo com o tamanho do texto (max 40% da página)
    const folderColW = Math.min(Math.floor(usableW * 0.4), Math.ceil(maxFolderW + 6));
    const remainW = usableW - folderColW;

    // Largura de cada coluna de usuario
    const totalUsers = data.userList.length;
    // Cada coluna de usuario terá no mínimo 8mm e no máximo 30mm
    const minUserColW = 5.5;
    const maxUserColW = 12;
    const idealUserColW = remainW / totalUsers;
    const userColW = Math.min(maxUserColW, Math.max(minUserColW, idealUserColW));

    // Quantos usuarios cabem em uma pagina?
    const usersPerPage = Math.floor(remainW / userColW);

    // Font size adaptativa: quanto menor a coluna, menor a fonte
    const dataFontSize = userColW < 12 ? 5.5 : userColW < 18 ? 6.5 : 7.5;

    // ── Particiona usuarios em grupos por pagina ───────────────────────────
    const userGroups: string[][] = [];
    for (let i = 0; i < totalUsers; i += usersPerPage) {
      userGroups.push(data.userList.slice(i, i + usersPerPage));
    }

    const drawPageHeader = (pageIdx: number, groupIdx: number) => {
      doc.setFillColor(67, 56, 202);
      doc.rect(0, 0, pageW, headerH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(`Permissoes: ${this.ascii(serverName)}`, mL, 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const totalGroups = userGroups.length;
      const suffix = totalGroups > 1 ? `  |  Pagina ${pageIdx + 1} de ${totalGroups}  |  Usuarios ${groupIdx + 1}-${Math.min(groupIdx + usersPerPage, totalUsers)} de ${totalUsers}` : '';
      doc.text(`${new Date().toLocaleDateString('pt-BR')}${suffix}`, pageW - mR, 8, { align: 'right' });
    };

    // ── Gera uma página por grupo de usuarios ─────────────────────────────
    userGroups.forEach((userGroup, gIdx) => {
      if (gIdx > 0) doc.addPage();
      drawPageHeader(gIdx, gIdx * usersPerPage);

      // Cabeçalho da tabela: trunca nome do usuario para caber na altura (texto vertical)
      const maxUserChars = 25;
      const headRow = ['Pasta', ...userGroup.map(u => this.truncate(this.ascii(u), maxUserChars))];

      // Corpo da tabela
      const bodyRows = data.folderList.map(folder => {
        const folderLabel = this.ascii(this.shortName(folder));
        const cells = userGroup.map(user => {
          const paths = data.userTopPaths.get(user);
          return paths && paths.has(folder) ? 'X' : '';
        });
        return [folderLabel, ...cells];
      });

      // Largura exata de cada coluna de usuario para preencher a página
      const exactUserColW = (usableW - folderColW) / userGroup.length;

      const colStyles: Record<number, any> = {
        0: { cellWidth: folderColW, halign: 'left', fontStyle: 'bold' }
      };
      for (let i = 1; i <= userGroup.length; i++) {
        colStyles[i] = { cellWidth: exactUserColW, halign: 'center' };
      }

      autoTable(doc, {
        startY: headerH + 3,
        margin: { left: mL, right: mR },
        head: [headRow],
        body: bodyRows,
        theme: 'grid',
        styles: {
          fontSize: dataFontSize,
          cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
          overflow: 'ellipsize',
          lineColor: [190, 190, 215],
          lineWidth: 0.18,
          textColor: [30, 30, 60]
        },
        headStyles: {
          fillColor: [30, 27, 75],
          textColor: [220, 220, 255],
          fontSize: dataFontSize,
          halign: 'center',
          valign: 'bottom',
          fontStyle: 'bold',
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 }
        },
        alternateRowStyles: { fillColor: [245, 245, 255] },
        columnStyles: colStyles,
        didParseCell: (hookData: any) => {
          if (hookData.section === 'head' && hookData.column.index > 0) {
            hookData.cell.styles.minCellHeight = 30; // Altura para acomodar o texto vertical
          }
        },
        willDrawCell: (hookData: any) => {
          if (hookData.section === 'head' && hookData.column.index > 0) {
            hookData.cell.text = []; // Remove o texto original horizontal
          }
          if (hookData.section === 'body' && hookData.column.index > 0 && hookData.cell.raw === 'X') {
            hookData.cell.styles.fillColor = [209, 250, 229];
            hookData.cell.styles.textColor = [22, 101, 52];
            hookData.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawCell: (hookData: any) => {
          if (hookData.section === 'head' && hookData.column.index > 0) {
            const doc = hookData.doc;
            const cell = hookData.cell;
            doc.setFontSize(dataFontSize);
            doc.setTextColor(220, 220, 255);
            doc.setFont('helvetica', 'bold');

            const textX = cell.x + cell.width / 2;
            const textY = cell.y + cell.height - 2;
            doc.text(cell.raw, textX, textY, { angle: 90, align: 'left', baseline: 'middle' });
          }
        }
      });
    });

    this.downloadBlob(doc.output('blob'), `Permissoes_${this.ascii(serverName)}.pdf`);
  }

  exportPermissionsToXLSX(folders: Folder[], permissions: Permission[], serverName: string) {
    const data = this.buildMatrix(permissions);

    const sheetData: string[][] = [];

    if (data.userList.length === 0 || data.folderList.length === 0) {
      sheetData.push(['Nenhuma permissao encontrada.']);
    } else {
      // Cabeçalho: Pasta + cada usuario
      sheetData.push(['Pasta', ...data.userList.map(u => this.ascii(u))]);

      // Uma linha por pasta
      for (const folder of data.folderList) {
        const folderLabel = this.ascii(this.shortName(folder));
        const row = [folderLabel];
        for (const user of data.userList) {
          const paths = data.userTopPaths.get(user);
          row.push(paths && paths.has(folder) ? 'X' : '');
        }
        sheetData.push(row);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    if (data.userList.length > 0) {
      const colWidths = [{ wch: 40 }];
      for (const u of data.userList) {
        colWidths.push({ wch: Math.max(8, u.length + 1) });
      }
      ws['!cols'] = colWidths;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Permissoes');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    this.downloadBlob(blob, `Permissoes_${this.ascii(serverName)}.xlsx`);
  }
}
