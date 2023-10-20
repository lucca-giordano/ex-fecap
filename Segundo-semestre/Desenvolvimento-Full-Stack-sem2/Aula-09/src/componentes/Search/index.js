import styled from "styled-components"
import Input from "../Input"
import Titulo from "../Titulo"
import { useState } from "react"
import { livros } from "./searchbooks"

const PesquisaContainer = styled.section`
    text-align: center;
    padding: 10px;
`

const SubTitulo = styled.h2`
    font-size: 21px;
    font-weight: 500;
    text-align: center;
    widht: 100%;

`

const Resultado = styled.div`
    display: flex;
    justify-content: center;
    align-itens: center;
    margin-bottom: 20px;
    cursor:pointer;
    p{
        width: 200px;
    }
    img{
        width: 100px;
    }
    &:hover{
        border: 1px solid #EB9B00;
    }

`

function Search(){
    const [livrosPesquisados, setLivrosPesquisados] = useState([])
    return(
        <PesquisaContainer>
            <Titulo>Já sabe por onde começar sua leitura?</Titulo>
            <SubTitulo>Encontre seu livro na Estante</SubTitulo>
            <Input type="text"
                placeholder="Faça sua Busca"
                onBlur={evento => {
                    const textoDigitado = evento.target.value
                    const resultadoPesquisa = livros.filter(livro => livro.nome.includes(textoDigitado))
                    setLivrosPesquisados(resultadoPesquisa)
                }}
            />
            {livrosPesquisados.map(livro => (
                <Resultado>
                    <img src={livro.src}></img>
                    <p>{livro.nome}</p>
                </Resultado>
            ))}
        </PesquisaContainer>
    )
}

export default Search