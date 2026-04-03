import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { 
  LayoutDashboard, 
  GraduationCap, 
  BarChart3, 
  Network, 
  Users, 
  UserCog, 
  Settings, 
  CheckSquare, 
  ListChecks,
  LogOut,
  ChevronDown,
  ChevronRight,
  Folder,
  Building2
} from 'lucide-react';
import clsx from 'clsx';

export default function Layout() {
  const { dbUser, logout, company, isAdmin } = useAuth();
  const location = useLocation();

  const polivalenciaPaths = ['/matrix', '/process-map', '/training', '/statistics'];
  const [isPolivalenciaOpen, setIsPolivalenciaOpen] = useState(
    polivalenciaPaths.includes(location.pathname)
  );

  const polivalenciaItems = [
    { name: 'Matriz', path: '/matrix', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Mapa de procesos', path: '/process-map', icon: Network, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Acciones formativas', path: '/training', icon: GraduationCap, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
    { name: 'Estadísticas', path: '/statistics', icon: BarChart3, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
  ];

  const topLevelItems = [
    { name: 'OHP', path: '/ohp', icon: Network, roles: ['admin', 'supervisor', 'user', 'lean_promotor'] },
  ];

  const adminItems = [
    { name: 'Equipos', path: '/admin/teams', icon: Users },
    { name: 'Usuarios', path: '/admin/users', icon: UserCog },
    { name: 'Actividades', path: '/admin/activities', icon: Folder },
    { name: 'Procesos', path: '/admin/processes', icon: Settings },
    { name: 'Tareas', path: '/admin/tasks', icon: CheckSquare },
    { name: 'Criterios', path: '/admin/criteria', icon: ListChecks },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800">GoZEN</h1>
          <p className="text-sm text-gray-500 mt-1">{dbUser?.name}</p>
          <p className="text-xs text-blue-600 font-medium uppercase mt-1">{dbUser?.role}</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {/* Main Menu Link */}
          <Link
            to="/"
            className={clsx(
              'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors mb-4',
              location.pathname === '/' 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <LayoutDashboard className={clsx('mr-3 h-5 w-5', location.pathname === '/' ? 'text-blue-700' : 'text-gray-400')} />
            Menú Principal
          </Link>

          {/* Polivalencia Section */}
          <div className="mb-2">
            <button
              onClick={() => setIsPolivalenciaOpen(!isPolivalenciaOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center">
                <Folder className="mr-3 h-5 w-5 text-gray-400" />
                Polivalencia
              </div>
              {isPolivalenciaOpen ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            
            {isPolivalenciaOpen && (
              <div className="mt-1 ml-4 pl-4 border-l border-gray-200 space-y-1">
                {polivalenciaItems.filter(item => item.roles.includes(dbUser?.role || 'user')).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={clsx(
                        'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                        isActive 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <Icon className={clsx('mr-3 h-4 w-4', isActive ? 'text-blue-700' : 'text-gray-400')} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Level Items */}
          {topLevelItems.filter(item => item.roles.includes(dbUser?.role || 'user')).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={clsx(
                  'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className={clsx('mr-3 h-5 w-5', isActive ? 'text-blue-700' : 'text-gray-400')} />
                {item.name}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-6 pb-2">
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Administración
                </p>
              </div>
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={clsx(
                      'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      isActive 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <Icon className={clsx('mr-3 h-5 w-5', isActive ? 'text-blue-700' : 'text-gray-400')} />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={logout}
            className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {company && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold border border-blue-100">
                <Building2 size={16} />
                {company.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{dbUser?.name}</p>
              <p className="text-xs text-gray-500 uppercase">{dbUser?.role}</p>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
