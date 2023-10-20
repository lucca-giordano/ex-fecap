import { livros } from "./dados"
import Titulo from "../Titulo"
import styled from "styled-components"
import CardRecomenda from "../CardRecomenda"
import imagemLivro from '../../imagens/fundacao.webp'

const ultimosLancamentosContainer = styled.section`

`

const novosLivrosContainer = styled.div`

`

function ultimosLancamentos (){
    return(
    <ultimosLancamentosContainer>
        <Titulo>Ultimos lançamentos</Titulo>
        <novosLivrosContainer>

            {/*  
            {livros.map(livro => (
                <CardRecomenda
                    key={livro.id}
                    imagem={livro.src}
                    titulo={livro.nome}
                />
            ))}
            */}
        </novosLivrosContainer>
    </ultimosLancamentosContainer>
    )
}