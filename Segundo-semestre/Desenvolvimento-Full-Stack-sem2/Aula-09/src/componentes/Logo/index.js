import logo from '../../imagens/logo.JPG'
import styled from 'styled-components'

const LogoContainer = styled.div`
    display:flex;
    font-size:22px;
`
const LogoImage = styled.img`
    margin-right: 10px;
`
function Logo(){
    return(
        <LogoContainer>
        <LogoImage 
            src={logo}
            alt="Descrição da Imagem"
           />
      </LogoContainer>
    )
}

export default Logo