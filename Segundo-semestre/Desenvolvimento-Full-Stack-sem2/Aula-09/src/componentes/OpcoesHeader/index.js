import styled from 'styled-components'

const Opcoes = styled.ul`
    display: flex;
`
const Opcao = styled.li`
    display:flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    padding: 0 5px;
    height: 100%;
    min-width: 120px;
    cursor: pointer;
`


const textoOpcoes = ['Antigos', 'Novas Aquisições', 'Minha Estante']

function OpcoesHeader () {
    return(
        <Opcoes>
        {textoOpcoes.map ((texto) => (
           <Opcao><p>{texto}</p></Opcao> 
        ))}
      </Opcoes>   
    )
}

export default OpcoesHeader