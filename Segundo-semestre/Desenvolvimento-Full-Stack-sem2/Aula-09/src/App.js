import Header from './componentes/Header'
import Search from './componentes/Search'
import styled from 'styled-components'

const AppContainer = styled.div`
  width: 100vw;
  height:100vh;
  background-image: linear-gradient(180deg, #ccc 35%, #2c2c2c);
`
function App() {
  return (
    <AppContainer>
          <Header />
          <Search />
    </AppContainer>
  )
}

export default App
