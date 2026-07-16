import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { Server } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ServersService {
  private path = '/servers';

  constructor(private api: ApiService) {}

  getAll(): Observable<Server[]> {
    return this.api.get<Server[]>(this.path);
  }

  getById(id: string): Observable<Server> {
    return this.api.get<Server>(`${this.path}/${id}`);
  }

  create(server: Partial<Server>): Observable<Server> {
    return this.api.post<Server>(this.path, server);
  }

  update(id: string, server: Partial<Server>): Observable<Server> {
    return this.api.put<Server>(`${this.path}/${id}`, server);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${this.path}/${id}`);
  }

  sync(id: string): Observable<any> {
    return this.api.post<any>(`${this.path}/${id}/sync`, {});
  }
}
