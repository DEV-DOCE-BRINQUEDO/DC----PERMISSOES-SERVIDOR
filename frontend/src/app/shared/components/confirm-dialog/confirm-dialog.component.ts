import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, CommonModule],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-icon" [class.danger]="data.danger">
        <mat-icon>{{ data.icon || (data.danger ? 'warning' : 'help') }}</mat-icon>
      </div>
      <h2 class="dialog-title">{{ data.title }}</h2>
      <p class="dialog-message">{{ data.message }}</p>
      <div class="dialog-actions">
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          {{ data.cancelLabel || 'Cancelar' }}
        </button>
        <button
          mat-flat-button
          [class.danger-btn]="data.danger"
          [class.confirm-btn]="!data.danger"
          (click)="onConfirm()"
        >
          {{ data.confirmLabel || 'Confirmar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      padding: 32px;
      text-align: center;
      max-width: 380px;
    }
    .dialog-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      background: rgba(99, 102, 241, 0.1);
    }
    .dialog-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--accent-color);
    }
    .dialog-icon.danger { background: rgba(239, 68, 68, 0.1); }
    .dialog-icon.danger mat-icon { color: #ef4444; }
    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 10px;
    }
    .dialog-message {
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 28px;
    }
    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .cancel-btn { flex: 1; border-color: var(--border-color) !important; color: var(--text-secondary) !important; }
    .confirm-btn { flex: 1; background: var(--accent-color) !important; color: white !important; }
    .danger-btn { flex: 1; background: #ef4444 !important; color: white !important; }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onConfirm() { this.dialogRef.close(true); }
  onCancel() { this.dialogRef.close(false); }
}
