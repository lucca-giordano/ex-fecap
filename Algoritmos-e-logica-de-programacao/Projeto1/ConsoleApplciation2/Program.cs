String[][]? Tabuleiro = null;
String Base = "|O|";
int[] posBase = { 9, 0 };
String Tiro = " ! ";
int[] posTiro = { -1, -1 };

String[][] iniciarTabuleiro()
{
    String[][] Tab = new String[10][];
    for (int i = 0; i < Tab.Length; i++)
    {
        Tab[i] = new String[5];
    }
    int lin = posBase[0];
    int col = posBase[1];
    Tab[lin][col] = Base;
    return Tab;
}


void imprimirTabuleiro(string[][] Tab)
{
    Console.Clear();
    Console.WriteLine("*** SPACE INVADERS - FECAP ***");
    for (int lin = 0; lin < Tab.Length; lin++)
    {
        for (int col = 0; col < Tab[lin].Length; col++)
        {
            if (!String.IsNullOrEmpty(Tab[lin][col]))
            {
                Console.Write("[" + Tab[lin][col] + "]");
            }
            else
            {
                Console.Write("[   ]");
            }
        }
        Console.WriteLine();
    }
}

ConsoleKeyInfo requisitarJogada()
{
    ConsoleKeyInfo key = new ConsoleKeyInfo();

    if (Console.KeyAvailable)
    {
        key = Console.ReadKey(true);
    }
    return key;
}
void executarJogada(ConsoleKeyInfo key, string[][] tabuleiro, String Base, int[] posBase, String Tiro, int[] posTiro)
{
    int lin = posBase[0];
    int col = posBase[1];
    switch (key.Key)
    {
        case ConsoleKey.RightArrow:
            try
            {
                tabuleiro[lin][col] = "";
                col++;
                tabuleiro[lin][col] = Base;
                posBase[1] = col;
                break;
            }
            catch (System.IndexOutOfRangeException)
            {
                break;
            }
        case ConsoleKey.LeftArrow:
            try
            {
                tabuleiro[lin][col] = "";
                col--;
                tabuleiro[lin][col] = Base;
                posBase[1] = col;
                break;
            }
            catch(System.IndexOutOfRangeException)
            {
                break;
            }
        case ConsoleKey.Spacebar:
            posTiro[0] = lin - 1;
            posTiro[1] = col;
            tabuleiro[lin - 1][col] = Tiro;
            break;
    }

}

void atualizarTabuleiro(String[][] tabuleiro, String Base, int[] posBase, string Tiro, int[] posTiro)
{
    int lin = posTiro[0];
    int col = posTiro[1];
    if (lin > 0)
    {
        tabuleiro[lin][col] = "";
        lin--;
        tabuleiro[lin][col] = Tiro;
        posTiro[0] = lin;

    }
}


bool fim = false;
ConsoleKeyInfo key;
Tabuleiro = iniciarTabuleiro();
while (!fim)
{
    imprimirTabuleiro(Tabuleiro);
    key = requisitarJogada();
    if (key.Key == ConsoleKey.Escape)
    {
        fim = true;
    }
    else
    {
        executarJogada(key, Tabuleiro, Base, posBase, Tiro, posTiro);
        atualizarTabuleiro(Tabuleiro, Base, posBase, Tiro, posTiro);
    }
    Thread.Sleep(50);
}

