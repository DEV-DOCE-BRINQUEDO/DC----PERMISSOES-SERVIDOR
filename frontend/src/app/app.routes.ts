import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'servers',
        pathMatch: 'full'
      },

      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users.component').then(m => m.UsersComponent),
        title: 'Usuários — DC Gerenciador'
      },
      {
        path: 'groups',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      {
        path: 'servers',
        loadComponent: () =>
          import('./features/servers/servers.component').then(m => m.ServersComponent),
        title: 'Servidores — DC Gerenciador'
      },
      {
        path: 'folders',
        loadComponent: () =>
          import('./features/folders/folders.component').then(m => m.FoldersComponent),
        title: 'Pastas & Permissões — DC Gerenciador'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
