String[][] Tabuleiro = null;
String Base = "|O|";
int[] posBase = { 9, 0 };

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
void executarJogada(ConsoleKeyInfo key, string[][] tabuleiro, String Base,int[] posBase)
{
    int lin = posBase[0];
    int col = posBase[1];
    switch (key.Key)
    { 
        case ConsoleKey.RightArrow:
            tabuleiro[lin][col] = "";
            col++;
            tabuleiro[lin][col] = Base;
            posBase[1] = col;
            break;
        case ConsoleKey.LeftArrow:
            tabuleiro[lin][col] = "";
            col--;
            tabuleiro[lin][col] = Base;
            posBase[1] = col;
            break;
    }

}
bool fim=false;
ConsoleKeyInfo key;
Tabuleiro = iniciarTabuleiro();
while (!fim)
{
    imprimirTabuleiro(Tabuleiro);
    key=requisitarJogada();
    if (key.Key == ConsoleKey.Escape)
    {
        fim = true;
    }
    else
    {
        executarJogada(key,Tabuleiro,Base,posBase);
    }
    Thread.Sleep(50);
}

