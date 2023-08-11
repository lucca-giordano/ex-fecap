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

String[] Tabuleiro = new string[9];
String[] Jogador = new String[2];
Jogador[0] = "X";
Jogador[1] = "O";
int JogVez = 0;
int Jogada = -1;
imprimirTabuleiro(Tabuleiro);
Boolean fim = false;
while (!fim)
{

    imprimirTabuleiro(Tabuleiro);
    Jogada = requisitarJogada(Jogador[JogVez]);
    Tabuleiro[Jogada] = Jogador[JogVez];
    JogVez = (JogVez + 1) % 2;
}

