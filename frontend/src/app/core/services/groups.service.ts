import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Group } from '../models/models';

@Injectable({ providedIn: 'root' })
export class GroupsService {
  constructor(private api: ApiService) {}

  getAll(serverId?: string): Observable<Group[]> {
    const params = serverId ? { serverId } : undefined;
    return this.api.get<Group[]>('/groups', params);
  }

  getById(id: string): Observable<Group> {
    return this.api.get<Group>(`/groups/${id}`);
  }

  create(group: Partial<Group>): Observable<Group> {
    return this.api.post<Group>('/groups', group);
  }

  update(id: string, group: Partial<Group>): Observable<Group> {
    return this.api.put<Group>(`/groups/${id}`, group);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/groups/${id}`);
  }

  addMember(groupId: string, userId: string): Observable<Group> {
    return this.api.post<Group>(`/groups/${groupId}/members`, { userId });
  }

  removeMember(groupId: string, userId: string): Observable<Group> {
    return this.api.delete<Group>(`/groups/${groupId}/members/${userId}`);
  }
}
