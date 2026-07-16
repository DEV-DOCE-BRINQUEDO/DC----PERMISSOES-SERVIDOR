import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandlerFn, HttpInterceptorFn } from '@angular/common/http';

/**
 * Auth Interceptor - BYPASS MODE ACTIVE
 * 
 * Currently passes all requests without adding Authorization header.
 * 
 * To enable:
 * 1. Set AUTH_BYPASS = false
 * 2. Configure the token key used by the portal (TOKEN_KEY)
 * 3. The interceptor will automatically inject: Authorization: Bearer <token>
 */
const AUTH_BYPASS = false;
const TOKEN_KEY = 'portal_token'; // Key used by the portal to store the token

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  if (AUTH_BYPASS) {
    return next(req); // Bypass: pass through without modification
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(authReq);
  }

  return next(req);
};
