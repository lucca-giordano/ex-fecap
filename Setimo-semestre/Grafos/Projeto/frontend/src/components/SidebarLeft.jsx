import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, User, Network as NetworkIcon, MoreHorizontal, LogOut } from 'lucide-react';
import { AuthContext } from '../AuthContext';
import { getAvatarUrl } from '../utils';

export default function SidebarLeft() {
  const { currentUser, logout } = useContext(AuthContext);
  const [showMenu, setShowMenu] = useState(false);

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink 
      to={to} 
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: '20px', padding: '15px 20px',
        fontSize: '1.25rem', color: isActive ? '#2ed573' : '#636e72',
        fontWeight: isActive ? '800' : '500',
        textDecoration: 'none', borderRadius: '30px', transition: 'all 0.2s',
        background: isActive ? '#e8f8f5' : 'transparent'
      })}
      onMouseOver={e=> {if(!e.currentTarget.style.background.includes('e8f8f5')) e.currentTarget.style.background = '#f4f7f6';}}
      onMouseOut={e=> {if(!e.currentTarget.style.background.includes('e8f8f5')) e.currentTarget.style.background = 'transparent';}}
    >
      {({ isActive }) => (
        <>
          <Icon size={28} strokeWidth={isActive ? 3 : 2} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', paddingTop: '10px' }}>
      
      {/* Logo Area */}
      <div style={{ padding: '10px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', color: '#2ed573' }}>
         <NetworkIcon size={36} strokeWidth={2.5} />
         <span style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px', color: '#2d3436' }}>Acadêmica<span style={{color: '#2ed573'}}>.</span></span>
      </div>

      {/* NavLinks */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <NavItem to="/" icon={Home} label="Comunidade" />
        <NavItem to={`/profile/${currentUser.id}`} icon={User} label="Meu Perfil" />
        <NavItem to="/network" icon={NetworkIcon} label="Matriz de Grafos" />
      </nav>

      <div style={{ flex: 1 }}></div>

      <div style={{ marginTop: 'auto', marginBottom: '20px', position: 'relative' }}>
          {showMenu && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, width: '100%', background: '#fff', borderRadius: '16px', padding: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', marginBottom: '10px', zIndex: 100 }}>
                  <div onClick={logout} style={{ padding: '12px 15px', color: '#ff7675', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderRadius: '12px', transition: 'background 0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#fff0f0'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>
                      <LogOut size={18} /> Sair da conta
                  </div>
              </div>
          )}
          <div onClick={() => setShowMenu(!showMenu)} style={{ padding: '10px', borderRadius: '35px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s', background: showMenu ? '#f4f7f6' : 'transparent' }} onMouseOver={e=>e.currentTarget.style.background='#f4f7f6'} onMouseOut={e=> {if(!showMenu) e.currentTarget.style.background='transparent';}}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={getAvatarUrl(currentUser.name, currentUser.avatar)} alt="Avatar" style={{ width: '45px', height: '45px', borderRadius: '50%', background: '#2d3436' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontWeight: '800', fontSize: '1rem', color: '#2d3436', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{currentUser.name}</span>
                 <span style={{ color: '#636e72', fontSize: '0.9rem' }}>@{currentUser.username}</span>
              </div>
            </div>
            <MoreHorizontal color="#2d3436" size={20} />
          </div>
      </div>

    </div>
  );
}
