void imprimirTabuleiro(string[] Tab)
{
    Console.Clear();
    Console.WriteLine("*** JOGA DA VELHA - FECAP ***");
    for (int i = 0; i < Tab.Length; i++)
    {
        if (i % 3 == 0) { Console.WriteLine(); }
        if (!String.IsNullOrEmpty(Tab[i]))
        {
            Console.Write("[" + Tab[i] + "]");
        }
        else
        {
            Console.Write("[" + i + "]");
        }
    }
    Console.WriteLine();

}

int requisitarJogada(string JogadorVez)
{
    int Jogada;
    Console.WriteLine("Jogador da Vez peça: " + JogadorVez);
    Console.Write("Entre com uma jogada de uma casa vazia:");
    Jogada = Convert.ToInt32(Console.ReadLine());
    return Jogada;

}


bool jogadaValida(int jogada, string[] tabuleiro)
{
    bool ok = true;
    if (jogada > 8) { ok = false; }
    else if (!String.IsNullOrEmpty(tabuleiro[jogada]))
    {
        ok = false;
    }
    return ok;
}


void executarJogada(int jogada, string[] tab, string jogador)
{
    tab[jogada] = jogador;
}

bool verificarLinha(string[] tab)
{
    bool venceu = false;
    //Verifica apenas se a 1ªLINHA do Tabuleiro é VENCEDORA
    int linha = 0;
    while (!venceu && linha < tab.Length)
    {
        if (!String.IsNullOrEmpty(tab[linha]))
        {
            // verificar horizontal
            if (tab[linha] == tab[linha + 1] && tab[linha + 1] == tab[linha + 2])
            {
                venceu = true;
            }
            
        }
        linha += 3;
    }
    return venceu;
}

bool verificarColuna(string[] tab)
{
    bool venceu = false;
    int coluna = 0;
    while (!venceu && coluna <= 2)
    {
        if (!String.IsNullOrEmpty(tab[coluna]))
        {
            if (tab[0] == tab[3] && tab[3] == tab[6])
            {
                venceu = true;
            }
            
            else if (tab[1] == tab[4] && tab[4] == tab[7])
            {
                venceu = true;
            }
            else if (tab[2] == tab[5] && tab[5] == tab[8])
            {
                venceu = true;
            }
            else
            {
                venceu = false;
            }
            
        }

        coluna++;
    }

    return venceu;
}

bool verificarDiagonal(string[] tab)
{
    bool venceu = false;
    return venceu;
}

bool verificarVencedor(string[] tab)
{
    bool venceu = false;

    if (!venceu)
    {
        venceu = verificarLinha(tab);
    }

    else if (!venceu)
    {
        venceu = verificarColuna(tab);
    }
    else if (!venceu)
    {
        venceu = verificarDiagonal(tab);
    }

    return venceu;

}

String[] Tabuleiro = new string[9];
String[] Jogador = new String[2];
Jogador[0] = "X";
Jogador[1] = "O";
int JogVez = 0;
int Jogada = -1;
imprimirTabuleiro(Tabuleiro);
Boolean fim = false;
String vencedor = "";
bool venceu = false;
while (!fim)
{

    imprimirTabuleiro(Tabuleiro);
    Jogada = requisitarJogada(Jogador[JogVez]);
    if (jogadaValida(Jogada, Tabuleiro))
    {
        executarJogada(Jogada, Tabuleiro, Jogador[JogVez]);
        venceu = verificarVencedor(Tabuleiro);
        if (verificarLinha(Tabuleiro))
        {
            fim= true;
            vencedor = Jogador[JogVez];
            Console.WriteLine("O jogador " + vencedor + " ganhou o jogo!");
        }
        JogVez = (JogVez + 1) % 2;
    }
    else
    {
        Console.WriteLine("JOGADA INVÁLIDA!!");
        Console.WriteLine("PRESSIONE ENTER PARA CONTINUAR...");
        Console.ReadLine();
    }
}

