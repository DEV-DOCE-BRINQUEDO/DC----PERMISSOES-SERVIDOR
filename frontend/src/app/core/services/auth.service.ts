import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserMe {
  success: boolean;
  message: any;
  data: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  errors: any;
  meta: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private portalApiUrl = environment.apiUrl + '/auth/me';
  
  // O estado atual do usuario autenticado
  currentUser = signal<UserMe['data'] | null>(null);
  
  constructor(private http: HttpClient) {
    this.checkSession();
  }

  checkSession() {
    const token = localStorage.getItem('portal_token');
    if (token) {
      this.http.get<UserMe>(this.portalApiUrl).pipe(
        tap(response => {
          if (response.success && response.data) {
            this.currentUser.set(response.data);
          }
        }),
        catchError(err => {
          console.error('Falha ao validar sessão no portal', err);
          return of(null);
        })
      ).subscribe();
    }
  }

  logout() {
    localStorage.removeItem('portal_token');
    this.currentUser.set(null);
    window.location.reload();
  }
}
