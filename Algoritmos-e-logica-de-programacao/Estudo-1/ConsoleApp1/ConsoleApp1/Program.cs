static void Exemplo1(int i){
    if (i > 0){
    Exemplo1(i - 1);
    }
    Console.Write(i + "|");
}

static void Exemplo2(int i)
{
    for (int j = 0; j < i; j++){
        Console.Write("*");
    }

    Console.WriteLine("");

    if (i > 1){
        Exemplo2(i - 1);         
    }

    for (int j = 0; j < i; j++){
        Console.Write("*");
    }

    Console.WriteLine("");
}

Exemplo1(5);
Console.WriteLine("\n");
Exemplo2(5);