import React from 'react';
import GraphVisualizer from '../GraphVisualizer'; 

export default function Network() {
  return (
    <div style={{ height: '100vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <GraphVisualizer />
        </div>
    </div>
  );
}
