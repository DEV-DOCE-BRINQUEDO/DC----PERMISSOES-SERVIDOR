import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Folder, FolderNode, Permission } from '../models/models';

@Injectable({ providedIn: 'root' })
export class FoldersService {
  constructor(private api: ApiService) {}

  getAll(serverId?: string): Observable<{ folders: Folder[]; tree: FolderNode[] }> {
    const params = serverId ? { serverId } : undefined;
    return this.api.get<{ folders: Folder[]; tree: FolderNode[] }>('/folders', params);
  }

  getFlat(serverId?: string): Observable<Folder[]> {
    const params = serverId ? { serverId } : undefined;
    return this.api.get<Folder[]>('/folders/flat', params);
  }

  getChildren(serverId: string, parentPath: string): Observable<{ folders: Folder[]; tree: FolderNode[] }> {
    return this.api.get<{ folders: Folder[]; tree: FolderNode[] }>('/folders', { serverId, parentPath });
  }

  create(folder: Partial<Folder>): Observable<Folder> {
    return this.api.post<Folder>('/folders', folder);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/folders/${id}`);
  }

  getAllPermissions(serverId?: string): Observable<Permission[]> {
    const params = serverId ? { serverId } : undefined;
    return this.api.get<Permission[]>('/folders/permissions', params);
  }

  getPermissionsByPath(path: string, serverId?: string): Observable<Permission[]> {
    const params: any = { path };
    if (serverId) params.serverId = serverId;
    return this.api.get<Permission[]>('/folders/permissions/by-path', params);
  }

  setPermission(permission: Partial<Permission>): Observable<Permission> {
    return this.api.post<Permission>('/folders/permissions', permission);
  }

  deletePermission(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/folders/permissions/${id}`);
  }
}
