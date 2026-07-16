import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '../models/models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private api: ApiService) {}

  getAll(serverId?: string): Observable<User[]> {
    const params = serverId ? { serverId } : undefined;
    return this.api.get<User[]>('/users', params);
  }

  getById(id: string): Observable<User> {
    return this.api.get<User>(`/users/${id}`);
  }

  create(user: Partial<User>): Observable<User> {
    return this.api.post<User>('/users', user);
  }

  update(id: string, user: Partial<User>): Observable<User> {
    return this.api.put<User>(`/users/${id}`, user);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/users/${id}`);
  }

  getUserGroups(id: string): Observable<any[]> {
    return this.api.get<any[]>(`/users/${id}/groups`);
  }

  getPermissions(id: string): Observable<any[]> {
    return this.api.get<any[]>(`/users/${id}/permissions`);
  }
}
