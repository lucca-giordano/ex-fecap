Random rnd = new Random();

int dado1, dado2, count, lim, win, loss;
Console.Write("Insira a quantidade de vezes que deseja jogar: ");
lim = Convert.ToInt32(Console.ReadLine());
string SN = "S";
count = 0;
win = 0;
loss = 0;
while (count <= lim && SN.ToUpper() == "S")
{
    dado1 = rnd.Next(1, 7);
    dado2 = rnd.Next(1, 7);
    Console.WriteLine("Dado 1: " + dado1);
    Console.WriteLine("Dado 2: " + dado2);
    count++;

    if (dado1 == dado2)
    {
        Console.WriteLine("Você ganhou!");
        Console.WriteLine("Os dados são iguais!");
        win++;
    }
    else if (dado1 + dado2 == 7 || dado1 + dado2 == 11)
    {
        Console.WriteLine("Você ganhou!");
        Console.WriteLine("A soma dos dados é 11 ou 7");
        win++;
    }
    else
    {
        Console.WriteLine("Você perdeu!");
        loss++;
    }

    Console.WriteLine("Você ganhou " + win + " vezes");
    Console.WriteLine("Você perdeu " + loss + " vezes");
    Console.Write("Deseja continuar? ");
    SN = Console.ReadLine();

}
