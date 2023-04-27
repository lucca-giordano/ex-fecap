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

String[] Tabuleiro = new string[9];
String[] Jogador = new String[2];
Jogador[0] = "X";
Jogador[1] = "O";

imprimirTabuleiro(Tabuleiro);
Console.WriteLine("Pressione enter...");
Console.ReadLine();
Tabuleiro[0] = Jogador[0];
imprimirTabuleiro(Tabuleiro);
Console.WriteLine("Pressione enter...");
Console.ReadLine();
Tabuleiro[1] = Jogador[1];
imprimirTabuleiro(Tabuleiro);

