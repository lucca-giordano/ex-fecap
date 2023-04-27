

ConsoleKeyInfo requisitarJogada()
{
    ConsoleKeyInfo key = new ConsoleKeyInfo();

    if (Console.KeyAvailable )
    {
        key = Console.ReadKey(true);
        
        switch (key.Key)
        {
            case ConsoleKey.UpArrow:
                Console.WriteLine("Seta para Cima");
                break;
            case ConsoleKey.DownArrow:
                Console.WriteLine("Seta Para Baixo");
                break;

            case ConsoleKey.RightArrow:
                Console.WriteLine("Seta Para Direita");
                break;

            case ConsoleKey.LeftArrow:
                Console.WriteLine("Seta Para Esquerda");
                break;
            case ConsoleKey.Spacebar:
                Console.WriteLine("Barro de Espaço");
                break;
            case ConsoleKey.Enter:
                Console.WriteLine("Enter");
                break;

            case ConsoleKey.Escape:
                Console.WriteLine("Escape");
                break;

            default:
                Console.WriteLine(key.KeyChar);
                break;
        }
    }
    return key;
}

while (requisitarJogada().Key != ConsoleKey.Escape)
{
    Console.Write("!");
    Thread.Sleep(100);
}