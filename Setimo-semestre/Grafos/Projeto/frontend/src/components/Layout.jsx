import React from 'react';
import SidebarLeft from './SidebarLeft';
import SidebarRight from './SidebarRight';

export default function Layout({ children }) {
  return (
    <div style={{
      maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '275px 1fr 350px',
      gap: '0', minHeight: '100vh', padding: '0 20px', alignItems: 'start'
    }}>
      <aside style={{ position: 'sticky', top: '0', height: '100vh', padding: '20px 0' }}>
        <SidebarLeft />
      </aside>
      
      <main style={{ borderLeft: '1px solid #f1f2f6', borderRight: '1px solid #f1f2f6', paddingBottom: '100px' }}>
        {children}
      </main>
      
      <aside style={{ position: 'sticky', top: '0', height: '100vh', padding: '20px 0', overflowY: 'auto' }}>
        <SidebarRight />
      </aside>
    </div>
  );
}
