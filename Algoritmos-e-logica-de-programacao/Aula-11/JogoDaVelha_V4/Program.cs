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

bool verificarVencedor(string[] tab)
{
    bool venceu = false;
    //Verifica apenas se a 1ªLINHA do Tabuleiro é VENCEDORA
    if (!String.IsNullOrEmpty(tab[0]))
    {
        if (tab[0] == tab[1] && tab[1] == tab[2]) 
        {
            venceu = true;
        }
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
while (!fim)
{

    imprimirTabuleiro(Tabuleiro);
    Jogada = requisitarJogada(Jogador[JogVez]);
    if (jogadaValida(Jogada, Tabuleiro))
    {
        executarJogada(Jogada, Tabuleiro, Jogador[JogVez]);
        if (verificarVencedor(Tabuleiro))
        {
            fim= true;
            vencedor = Jogador[JogVez];
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

