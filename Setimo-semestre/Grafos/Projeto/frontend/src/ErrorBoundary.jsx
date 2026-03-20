import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary captou uma falha fatal:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#15202b', color: '#ff4757', height: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{color: '#ff4757'}}>🚨 Erro Fatal Renderização</h1>
          <p>O React desmontou a árvore por causa do seguinte erro em código:</p>
          <pre style={{ background: '#1c2732', padding: '20px', borderRadius: '8px', color: '#fff', whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
