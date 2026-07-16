import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';

/**
 * Auth Guard - BYPASS MODE ACTIVE
 * 
 * Authentication is currently disabled. This guard allows all routes.
 * 
 * To enable authentication:
 * 1. Set AUTH_BYPASS = false
 * 2. Implement token validation logic (check localStorage/sessionStorage for portal token)
 * 3. Coordinate with portal team on token structure and storage key
 */
const AUTH_BYPASS = false;

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (AUTH_BYPASS) {
      return true;
    }

    // Capture token from URL if present
    const urlToken = route.queryParamMap.get('token');
    if (urlToken) {
      localStorage.setItem('portal_token', urlToken);
      
      // Remove token from URL to keep it clean
      const currentUrl = this.router.url.split('?')[0];
      this.router.navigate([currentUrl || '/'], { replaceUrl: true });
      return true;
    }

    const token = localStorage.getItem('portal_token');
    if (!token) {
      // Sem token, redireciona para uma pagina de erro ou portal.
      // Como não temos a URL do portal, vamos apenas bloquear e mostrar alert.
      alert('Acesso negado. Por favor, acesse o sistema através do Portal.');
      return false;
    }

    return true;
  }
}
