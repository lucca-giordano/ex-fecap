String[][] Tabuleiro=null;

String[][] iniciarTabuleiro()
{
    String[][]  Tab = new String[25][];
    for (int i = 0; i < Tab.Length; i++)
    {
        Tab[i] = new String[10];
    }
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

Tabuleiro=iniciarTabuleiro();
imprimirTabuleiro(Tabuleiro);