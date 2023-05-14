String[][]? Tabuleiro = null;
String Base = "|O|";
String Inimigo = "|X|";

int[] posBase = { 9, 0 };
int[] posInimigo = { 0, 0 };

String Tiro = " ! ";

int[] posTiro = { -1, -1 };

int pontos = 0;

Random rnd = new Random();

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

    int colInimigo = rnd.Next(Tab[0].Length);
    Tab[0][colInimigo] = Inimigo;
    posInimigo[0] = 0;
    posInimigo[1] = colInimigo;

    return Tab;
}


void imprimirTabuleiro(string[][] Tab)
{
    Console.Clear();
    Console.WriteLine("*** SpaceInvaders - FECAP ***");
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
    Console.WriteLine("Sua pontuação é: " + pontos);
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
            if (col < tabuleiro[0].Length - 1)
            {
                tabuleiro[lin][col] = "";
                col++;
                tabuleiro[lin][col] = Base;
                posBase[1] = col;
            }
            break;
        case ConsoleKey.LeftArrow:
            if (col > 0 )
            {
                tabuleiro[lin][col] = "";
                col--;
                tabuleiro[lin][col] = Base;
                posBase[1] = col;
            }
            break;

        case ConsoleKey.Spacebar:
            posTiro[0] = lin - 1;
            posTiro[1] = col;
            tabuleiro[lin - 1][col] = Tiro;
            break;
    }
}

int[] geradorInimigo(String[][] tabuleiro, int[] posInimigo)
{
    int colInimigo = rnd.Next(tabuleiro[0].Length);
    tabuleiro[0][colInimigo] = Inimigo;
    posInimigo[0] = 0;
    posInimigo[1] = colInimigo;
    return posInimigo;
}


void atualizarTabuleiro(String[][] tabuleiro, String Base, int[] posBase, string Tiro, int[] posTiro, String Inimigo, int[] posInimigo)
{
    int linTiro = posTiro[0];
    int colTiro = posTiro[1];
    int linInimigo = posInimigo[0];
    int colInimigo = posInimigo[1];


    if (linTiro > 0)
    {
        tabuleiro[linTiro][colTiro] = "";
        linTiro--;
        tabuleiro[linTiro][colTiro] = Tiro;
        posTiro[0] = linTiro;

        if (linTiro == linInimigo && colTiro == colInimigo)
        {
            tabuleiro[linInimigo][colInimigo] = "";
            posInimigo[0] = -1;
            posInimigo[1] = -1;
            pontos += rnd.Next(1, 9);
            geradorInimigo(tabuleiro, posInimigo);
        }

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
        atualizarTabuleiro(Tabuleiro, Base, posBase, Tiro, posTiro, Inimigo, posInimigo);
    }
    Thread.Sleep(50);
}
