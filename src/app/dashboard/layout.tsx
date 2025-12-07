// src/app/dashboard/layout.tsx
"use client"

import React, { useState, ReactNode, useEffect, createContext, useContext, Suspense } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Menu,
  X,
  Scale,
  Wallet,
  UserX,
  Lock,
  ArrowRight,
  FileText,
  Library,
  Bot,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { getDecisionStatsAction } from '@/app/actions';

// Custom Icon Components
interface CustomIconProps {
  size?: number;
  className?: string;
  isActive?: boolean;
}

const InstagramIcon: React.FC<CustomIconProps> = ({ size = 20, className = '', isActive = false }) => {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <img
        src="/ig.png"
        alt="Instagram"
        className={`transition-all duration-200 ${className}`}
        style={{
          width: size,
          height: size,
          opacity: isActive ? 1 : 0.7,
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
        }}
      />
    </div>
  );
};

const LinkedInIcon: React.FC<CustomIconProps> = ({ size = 20, className = '', isActive = false }) => {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <img
        src="/linkedin.png"
        alt="LinkedIn"
        className={`transition-all duration-200 ${className}`}
        style={{
          width: size,
          height: size,
          opacity: isActive ? 1 : 0.7,
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
        }}
      />
    </div>
  );
};

// Menu items configuration
interface SubMenuItem {
  label: string;
  path: string;
  count?: number;
  statusKey?: 'total' | 'new' | 'in_progress' | 'pending' | 'closed';
}

interface MenuItem {
  IconComponent: LucideIcon | React.FC<CustomIconProps>;
  label: string;
  path: string;
  fullWidth?: boolean;
  iconType?: 'instagram' | 'linkedin';
  subItems?: SubMenuItem[];
}

interface DecisionStats {
  total: number;
  new: number;
  in_progress: number;
  pending: number;
  closed: number;
}

const getMenuItems = (lang: 'pl', stats?: DecisionStats): MenuItem[] => [
  { IconComponent: Home, label: 'Dashboard', path: '/dashboard', fullWidth: true },
  {
    IconComponent: FileText,
    label: 'Postępowania (EZD)',
    path: '/dashboard/cases',
    subItems: [
      { label: 'Wszystkie', path: '/dashboard/cases', count: stats?.total || 0, statusKey: 'total' },
      { label: 'W toku', path: '/dashboard/cases?status=in_progress', count: stats?.in_progress || 0, statusKey: 'in_progress' },
      { label: 'Do wyjaśnienia', path: '/dashboard/cases?status=pending', count: stats?.pending || 0, statusKey: 'pending' },
      { label: 'Zakończone', path: '/dashboard/cases?status=closed', count: stats?.closed || 0, statusKey: 'closed' }
    ]
  },
  {
    IconComponent: Library,
    label: 'Baza decyzji',
    path: '/dashboard/decision',
    subItems: [
      { label: 'Czatuj', path: '/dashboard/decision?mode=chat' },
      { label: 'Przeglądaj', path: '/dashboard/decision?mode=browse' }
    ]
  },
  {
    IconComponent: Bot,
    label: 'Czat z KPA',
    path: '/dashboard/kpa',
    subItems: [
      { label: 'Czatuj', path: '/dashboard/kpa?mode=chat' },
      { label: 'Przeglądaj', path: '/dashboard/kpa?mode=browse' }
    ]
  }
];

const getCurrentPageLabel = (path: string | null, lang: 'pl' = 'pl') => {
  if (!path) return 'Dashboard';

  if (path.includes('/dashboard/ezd')) {
    return 'Symulator EZD PUW';
  }

  const menuItems = getMenuItems(lang);
  let menuItem = menuItems.find(item => path.split('?')[0] === item.path);

  if (!menuItem) {
    menuItem = menuItems.find(item => item.subItems?.some(sub => sub.path.split('?')[0] === path.split('?')[0]));
  }

  return menuItem?.label || 'Dashboard';
};

// Context Definitions
interface LayoutContextType {
  hoveredSidebar: boolean;
  setHoveredSidebar: (value: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (value: boolean) => void;
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
  decisionStats: DecisionStats;
  refreshStats: () => Promise<void>;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hoveredSidebar, setHoveredSidebar] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('sidebarExpanded') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [decisionStats, setDecisionStats] = useState<DecisionStats>({
    total: 0,
    new: 0,
    in_progress: 0,
    pending: 0,
    closed: 0
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpanded', hoveredSidebar.toString());
    }
  }, [hoveredSidebar]);

  const refreshStats = async () => {
    const result = await getDecisionStatsAction();
    if (result.success) {
      setDecisionStats(result.data);
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  return (
    <LayoutContext.Provider value={{
      hoveredSidebar,
      setHoveredSidebar,
      isMobileMenuOpen,
      setIsMobileMenuOpen,
      isNavigating,
      setIsNavigating,
      decisionStats,
      refreshStats
    }}>
      {children}
    </LayoutContext.Provider>
  );
};

const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used within LayoutProvider');
  return context;
};

const renderMenuIcon = (item: MenuItem, isActive: boolean, size: number = 20) => {
  const IconComponent = item.IconComponent;
  if (item.iconType === 'instagram' || item.iconType === 'linkedin') {
    return <IconComponent size={size} isActive={isActive} />;
  }
  return <IconComponent size={size} />;
};

// Sidebar Component
interface SidebarProps { currentLang: 'pl'; }

const Sidebar: React.FC<SidebarProps> = ({ currentLang }) => {
  const { hoveredSidebar, setHoveredSidebar, isMobileMenuOpen, setIsMobileMenuOpen, setIsNavigating, decisionStats } = useLayout();
  const pathname = usePathname();
  const menuItems = getMenuItems(currentLang, decisionStats);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isScreenSizeDetected, setIsScreenSizeDetected] = useState(false);

  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const normalizedPathname = pathname?.endsWith('/') ? pathname.slice(0, -1) : pathname;

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    if (pathname) {
      const activeParent = menuItems.find(item =>
        item.path === pathname || item.subItems?.some(sub => pathname.startsWith(sub.path.split('?')[0]))
      );
      if (activeParent && activeParent.subItems && !expandedMenus.includes(activeParent.path)) {
        setExpandedMenus(prev => [...prev, activeParent.path]);
      }
    }
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      setIsScreenSizeDetected(true);
      if (newIsMobile && hoveredSidebar) setHoveredSidebar(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hoveredSidebar, setHoveredSidebar]);

  const handleNavigation = () => {
    setIsNavigating(true);
    if (isMobile) setIsMobileMenuOpen(false);
    setTimeout(() => setIsNavigating(false), 500);
  };

  const toggleMenu = (path: string) => {
    setExpandedMenus(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const renderMenuItem = (item: MenuItem, index: number, isMobileRender: boolean) => {
    const isActive = !!(normalizedPathname === item.path || item.subItems?.some(sub => normalizedPathname === sub.path.split('?')[0]));
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedMenus.includes(item.path);
    const showExpandedContent = isExpanded && (isMobileRender || hoveredSidebar);

    const menuItemContent = (
      <>
        <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center transition-all duration-200 ${isActive ? 'text-blue-600 scale-110' : 'text-gray-600 group-hover/link:text-gray-700 group-hover/link:scale-105'}`}>
          {renderMenuIcon(item, isActive, 20)}
        </div>

        <span className={`ml-4 whitespace-nowrap font-medium overflow-hidden transition-all duration-300 ease-out flex-1 flex items-center justify-between
          ${(hoveredSidebar || isMobileRender) ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 translate-x-2 w-0'}`}>
          {item.label}
          {hasSubItems && (
            <span className="ml-2 text-gray-400">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
        </span>
      </>
    );

    const commonClasses = `relative flex items-center min-h-[48px] px-3 group/link rounded-xl transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 cursor-pointer
      ${isActive && !hasSubItems ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm border border-blue-200' : 'border border-transparent hover:bg-gray-50 text-gray-700 hover:shadow-sm hover:scale-[1.02]'}
    `;

    return (
      <li key={item.path} className="mb-1" style={{ transitionDelay: isMobileRender ? `${index * 50}ms` : '0ms' }}>
        <div className="relative group">

          {hasSubItems ? (
            <div
              onClick={() => toggleMenu(item.path)}
              className={commonClasses}
            >
              {menuItemContent}
            </div>
          ) : (
            <Link
              href={item.path}
              onClick={handleNavigation}
              className={commonClasses}
            >
              {menuItemContent}
            </Link>
          )}

          {hasSubItems && (
            <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-white ${(showExpandedContent) ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
              <ul className="space-y-1 pt-1 pb-2">
                {item.subItems!.map((subItem) => {
                   const isSubActive = pathname === subItem.path.split('?')[0] && (
                     subItem.path.includes('?')
                       ? window.location.search.includes(subItem.path.split('?')[1])
                       : window.location.search === ''
                   );

                   return (
                    <li key={subItem.path}>
                      <Link
                        href={subItem.path}
                        onClick={handleNavigation}
                        className={`flex items-center justify-between h-9 pl-12 pr-3 text-sm rounded-lg transition-colors
                          ${isSubActive ? 'text-blue-700 bg-blue-50 font-medium' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'}
                        `}
                      >
                        <span className="truncate">{subItem.label}</span>
                        {subItem.count !== undefined && (
                          <span className={`
                            ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full border
                            ${subItem.count > 0
                              ? 'bg-blue-100 text-blue-600 border-blue-200'
                              : 'bg-gray-100 text-gray-400 border-gray-200'}
                          `}>
                            {subItem.count}
                          </span>
                        )}
                      </Link>
                    </li>
                   );
                })}
              </ul>
            </div>
          )}

          {!hoveredSidebar && !isMobileRender && (
            <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              {item.label}
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
            </div>
          )}
        </div>
      </li>
    );
  };

  if (!isScreenSizeDetected) return null;

  if (isMobile) {
    if (!isClient) return null;
    return (
      <div className={`fixed left-0 z-50 top-16 bottom-1 w-72 bg-white/95 backdrop-blur-xl backdrop-saturate-150 shadow-2xl rounded-r-3xl transition-all duration-300 ease-out overflow-y-auto border-r border-gray-100 ${isMobileMenuOpen ? 'transform translate-x-0' : 'transform -translate-x-full'}`} style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div className="flex flex-col h-full">
          <nav className="flex-1 py-6">
            <ul className="space-y-2 px-4">
              {menuItems.map((item, index) => renderMenuItem(item, index, true))}
            </ul>
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed left-0 z-40 top-16 h-[calc(100vh-4rem)] bg-white shadow-xl rounded-r-3xl overflow-hidden backdrop-blur-sm transition-all duration-300 ease-out border-r border-gray-100 ${hoveredSidebar ? 'w-73' : 'w-20'}`}
      onMouseEnter={() => !isMobile && setHoveredSidebar(true)}
      onMouseLeave={() => !isMobile && setHoveredSidebar(false)}
      style={{ transform: 'translateX(0)', boxShadow: hoveredSidebar ? '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.1)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
    >
      <nav className="py-4 h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-200">
        <ul className="space-y-1 px-3">
          {menuItems.map((item, index) => renderMenuItem(item, index, false))}
        </ul>
      </nav>
    </div>
  );
};

// Header Component
interface HeaderProps { currentLang: 'pl'; langReady: boolean; }

const Header: React.FC<HeaderProps> = ({ currentLang, langReady }) => {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useLayout();
  const router = useRouter();

  const pathname = usePathname();
  const isEzdPage = pathname?.includes('/dashboard/ezd');

  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isScreenSizeDetected, setIsScreenSizeDetected] = useState(false);

  useEffect(() => setIsClient(true), []);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsScreenSizeDetected(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm border-b border-gray-200 z-50 flex items-center pr-6" style={{ paddingLeft: isMobile || !isScreenSizeDetected ? '1rem' : '1rem', transition: 'padding-left 0.3s ease-out' }}>
      <div className="flex items-center flex-shrink-0">
        {isMobile && isScreenSizeDetected && (
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="mr-4 p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95">
            <div className="relative w-6 h-6">
              {isMobileMenuOpen ? (isClient && <X className="h-6 w-6 text-gray-600 transition-transform duration-200 rotate-0 hover:rotate-90" />) : (isClient && <Menu className="h-6 w-6 text-gray-600 transition-transform duration-200" />)}
            </div>
          </button>
        )}

        <div
          className={`mr-4 ${isEzdPage ? 'cursor-default' : 'cursor-pointer'}`}
          onClick={() => !isEzdPage && router.push('/dashboard')}
        >
          <div className="flex items-center">
            <div className="h-12 w-auto bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center px-3 py-2">
              <img src="/logo.webp" alt="Logo" className="h-full w-auto object-contain" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]">
         <div className="hidden md:block border-b-2 border-red-600 pb-0.5 bg-white/90 px-24 text-center">
            <span className="font-normal text-gray-600 mr-1">
               Zadanie od MSiT:
            </span>
            <span className="font-bold text-gray-900">
               AI W SŁUŻBIE DECYZJI
            </span>
         </div>
      </div>
      <div className="flex-1"></div>
      <div className="flex items-center space-x-4">

        <Link
          href="/dashboard/ezd"
          target="_blank"
          rel="noopener noreferrer"
          className={`hidden md:block px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all font-['Poppins'] text-sm font-medium text-gray-800
            ${isEzdPage ? 'cursor-default' : 'hover:bg-gray-100 hover:shadow-md cursor-pointer hover:scale-105'}`
          }
          onClick={(e) => isEzdPage && e.preventDefault()}
        >
           Symulator EZD
        </Link>

        {isClient && (
          !isEzdPage ? (
            <a href="https://www.linkedin.com/in/move37th/" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:scale-105">
              <div className="flex items-center gap-2 font-['Poppins']">
                <span className="text-sm font-medium text-gray-800">Marcin Lisiak</span>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-500">move37th.ai</span>
              </div>
            </a>
          ) : (
            <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm cursor-default">
              <div className="flex items-center gap-2 font-['Poppins']">
                <span className="text-sm font-medium text-gray-800">Marcin Lisiak</span>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-gray-500">move37th.ai</span>
              </div>
            </div>
          )
        )}
      </div>
    </header>
  );
};

// Main Layout with Login Logic
interface DashboardLayoutProps {
  children: ReactNode;
  disableMenu?: boolean;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  disableMenu = false
}) => {
  const { hoveredSidebar, isNavigating, isMobileMenuOpen, setIsMobileMenuOpen } = useLayout();
  const pathname = usePathname();
  const isEzdPage = pathname?.includes('/dashboard/ezd');
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isScreenSizeDetected, setIsScreenSizeDetected] = useState(false);
  const [isVerySmallScreen, setIsVerySmallScreen] = useState(false);
  const [currentLang] = useState<'pl'>('pl');
  const [langReady, setLangReady] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const auth = localStorage.getItem('dashboard_auth_token');
    if (auth === 'valid') {
      setIsAuthenticated(true);
    }
    setIsCheckingAuth(false);
    setIsClient(true);
    setLangReady(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'marcin') {
      localStorage.setItem('dashboard_auth_token', 'valid');
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 2000);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsVerySmallScreen(window.innerWidth < 460);
      setIsScreenSizeDetected(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isCheckingAuth) {
    return null;
  }

  const menuItems = getMenuItems(currentLang);
  const currentMenuItem = menuItems.find(item =>
    (pathname?.endsWith('/') ? pathname.slice(0, -1) : pathname) === item.path
  );
  const isFullWidthPage = currentMenuItem?.fullWidth || false;

  return (
    <>
      {!isAuthenticated && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-md transition-all duration-500">
          <div className="w-full max-w-sm p-8 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex flex-col items-center transform transition-all animate-in fade-in zoom-in-95 duration-300">

            <div className="mb-6 p-4 bg-gray-50 rounded-full shadow-inner">
              <Lock className="w-8 h-8 text-gray-600" />
            </div>

            <h2 className="text-xl font-semibold text-gray-800 mb-2">Dostęp chroniony</h2>
            <p className="text-gray-500 text-sm mb-6 text-center">
              Wprowadź hasło, aby uzyskać dostęp do panelu.
            </p>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Hasło"
                  className={`
                    w-full px-4 py-3 rounded-xl border bg-white/50 focus:bg-white transition-all outline-none
                    focus:ring-2 focus:ring-offset-0 placeholder:text-gray-400 text-gray-800
                    ${loginError
                      ? 'border-red-300 focus:ring-red-200 animate-pulse'
                      : 'border-gray-200 focus:border-blue-300 focus:ring-blue-100'
                    }
                  `}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-gradient-to-r from-gray-800 to-black hover:from-gray-700 hover:to-gray-900 text-white font-medium rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group"
              >
                <span>Wejdź</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            {loginError && (
              <p className="mt-4 text-sm text-red-500 font-medium animate-in fade-in slide-in-from-top-1">
                Nieprawidłowe hasło
              </p>
            )}

            <div className="mt-8 text-xs text-gray-400">
               move37th.ai
            </div>
          </div>
        </div>
      )}

      <div className={`flex h-screen bg-gray-100 font-sans overflow-hidden transition-all duration-500 ${!isAuthenticated ? 'blur-sm scale-[0.99] pointer-events-none select-none' : 'blur-0 scale-100'}`}>
        {!disableMenu && !isEzdPage && <Sidebar currentLang={currentLang} />}
        {isMobile && isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ease-out ${
          isMobile || disableMenu || isEzdPage || !isScreenSizeDetected
            ? 'ml-0'
            : hoveredSidebar
              ? 'ml-64'
              : 'ml-20'
        }`}
          style={{
            paddingTop: '64px',
            height: '100vh'
          }}
        >
          <Header currentLang={currentLang} langReady={langReady} />

          <main className="flex-1 px-2 pb-4 pt-1.5 overflow-auto bg-gray-100 relative">
            {isNavigating && (
              <div className="absolute inset-0 z-30 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
              </div>
            )}

            {!isFullWidthPage && !disableMenu && (
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 transition-all duration-300">
                <div className="flex flex-row items-center w-full md:w-auto gap-3">
                  <div className="bg-white px-3 py-1.5 md:px-5 md:py-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                    <h2 className="text-base md:text-xl font-semibold text-gray-700 whitespace-nowrap">
                      {getCurrentPageLabel(pathname, currentLang)}
                    </h2>
                  </div>
                </div>

                <div className="hidden md:flex w-full justify-end items-center mt-2:mt-0">
                  {isClient && (
                    <div className="bg-white px-5 py-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                      <span className="text-sm font-medium text-gray-600">
                        {new Date().toLocaleDateString('pl-PL', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className={`
              transition-all duration-300 ease-out
              ${isVerySmallScreen
                ? 'bg-gray-100 p-0 h-full'
                : isFullWidthPage || disableMenu
                  ? 'bg-white rounded-xl shadow-sm p-0 h-full overflow-hidden border border-gray-200 hover:shadow-md'
                  : 'bg-white rounded-xl shadow-sm p-6 md:p-8 h-full border border-gray-200 hover:shadow-md'
              }`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

const DashboardLayoutWithProvider: React.FC<DashboardLayoutProps> = (props) => {
  return (
    <LayoutProvider>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }>
        <DashboardLayout {...props} />
      </Suspense>
    </LayoutProvider>
  );
};

export default DashboardLayoutWithProvider;

export { useLayout };