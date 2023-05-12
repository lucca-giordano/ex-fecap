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
    Console.WriteLine("*** EcoPescaria - FECAP ***");
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
            if (col < tabuleiro[0].Length - 1)
            {
                tabuleiro[lin][col] = "";
                col++;
                tabuleiro[lin][col] = Base;
                posBase[1] = col;
            }
            break;
        case ConsoleKey.LeftArrow:
            if (col > 0)
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
            // Defina o caractere para representar o rastro
            char rastro = '#';

            // Posição inicial do tiro
            int tiroLin = lin - 1;
            int tiroCol = col;

            // Loop para criar o rastro
            while (tiroLin >= 0)
            {
                // Marca a posição atual do tiro com o caractere de rastro
                tabuleiro[tiroLin][tiroCol] = " " + rastro.ToString() + " ";

                // Atualiza a posição do tiro para a próxima iteração
                tiroLin--;

                // Atualiza a exibição do tabuleiro

                // ...

                // Aguarde um curto período de tempo para criar o efeito de movimento
                Thread.Sleep(100);
            }

            // Limpe o rastro depois que o tiro desaparecer
            tabuleiro[tiroLin + 1][tiroCol] = ' '.ToString();

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



/*
//Solução 1:
case ConsoleKey.Spacebar:
    posTiro[0] = lin - 1;
    posTiro[1] = col;
    tabuleiro[lin - 1][col] = Tiro;

    // Cria uma cópia do tabuleiro para desenhar a linha
    var tabuleiroCopia = (string[][])tabuleiro.Clone();

    // Cria um novo thread para desenhar o rastro do tiro em segundo plano
    new Thread(() =>
    {
        for (int i = lin; i < tabuleiro.Length; i++)
        {
            // Preenche a linha com o caractere do rastro
            tabuleiroCopia[i][col] = Rastro;

            // Aguarda um tempo antes de apagar a linha
            Thread.Sleep(50);

            // Apaga a linha
            tabuleiroCopia[i][col] = "";
        }

        for (int i = lin - 1; i >= 0; i--)
        {
            // Preenche a linha com o caractere do rastro
            tabuleiroCopia[i][col] = Rastro;

            // Aguarda um tempo antes de apagar a linha
            Thread.Sleep(50);

            // Apaga a linha
            tabuleiroCopia[i][col] = "";
        }
    }).Start();

    break;

//Solução 2:
int[] gerarAlvoAleatorio(string[][] tabuleiro)
{
    Random random = new Random();
    int lin, col;
    do
    {
        lin = random.Next(tabuleiro.Length);
        col = random.Next(tabuleiro[0].Length);
    } while (tabuleiro[lin][col] != null);
    return new int[] { lin, col };
}
 
 
Solução 3:
 int[] posAlvo = gerarAlvoAleatorio(Tabuleiro);
tabuleiro[posAlvo[0]][posAlvo[1]] = "|X|"; // ou outro símbolo para representar o alvo

SOlução 4:
void atualizarTabuleiro(String[][] tabuleiro, String Base, int[] posBase, string Tiro, int[] posTiro, int[] posAlvo)
{
    int linTiro = posTiro[0];
    int colTiro = posTiro[1];
    int linAlvo = posAlvo[0];
    int colAlvo = posAlvo[1];
    if (linTiro == linAlvo && colTiro == colAlvo)
    {
        tabuleiro[linTiro][colTiro] = "|*|"; // ou outro símbolo para representar o alvo atingido
        posAlvo = gerarAlvoAleatorio(tabuleiro); // gera um novo alvo aleatório
        tabuleiro[posAlvo[0]][posAlvo[1]] = "|X|"; // ou outro símbolo para representar o novo alvo
    }
    else if (linTiro > 0)
    {
        tabuleiro[linTiro][colTiro] = "";
        linTiro--;
        tabuleiro[linTiro][colTiro] = Tiro;
        posTiro[0] = linTiro;
    }
}

*/