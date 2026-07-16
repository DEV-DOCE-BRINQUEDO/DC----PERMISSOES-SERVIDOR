export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  groups: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  membersData?: Partial<User>[];
  createdAt: string;
  updatedAt?: string;
}

export interface Folder {
  id: string;
  serverId: string;
  name: string;
  path: string;
  parentPath: string;
  children: string[] | FolderNode[];
}

export interface FolderNode extends Folder {
  children: FolderNode[];
}

export interface Permission {
  id: string;
  serverId: string;
  path: string;
  type: 'user' | 'group';
  targetId: string;
  targetName: string;
  read: boolean;
  write: boolean;
  rawRights?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface DashboardStats {
  totalServers: number;
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  totalFolders: number;
  totalPermissions: number;
}

export interface Server {
  id: string;
  name: string;
  ip: string;
  agentPort?: number;
  token?: string;
  rootPath?: string;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'failed';
  syncError?: string;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
