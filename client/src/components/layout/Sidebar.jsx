import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Grid2X2, 
  Folder, 
  UploadCloud, 
  ShieldCheck, 
  Activity, 
  Settings,
  LogOut,
  Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import './Sidebar.css';

const Sidebar = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Grid2X2 },
    { path: '/documents', label: 'Documents', icon: Folder },
    { path: '/upload', label: 'Upload', icon: UploadCloud },
    { path: '/logs', label: 'Access Logs', icon: ShieldCheck },
    { path: '/observability', label: 'Observability', icon: Activity },
    { path: '/settings', label: 'Settings', icon: Settings }
  ];

  const getUserInitials = (user) => {
    if (!user?.name && !user?.email) return 'U';
    const name = user.name || user.email;
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <Lock size={18} />
        </div>
        <div className="sidebar__wordmark">
          CloudDocVault
        </div>
      </div>

      <nav className="sidebar__nav">
        {navItems.slice(0, -1).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        
        <div className="sidebar__divider" />
        
        <NavLink
          to="/settings"
          className={({ isActive }) => 
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
        >
          <Settings size={16} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <div className="sidebar__avatar">
            {getUserInitials(user)}
          </div>
          <div className="sidebar__username">
            {user?.name || user?.email || 'User'}
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={logout}
          className="sidebar__logout"
        >
          <LogOut size={16} />
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;