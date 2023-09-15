Random rnd = new Random();

int dado1, dado2;

dado1 = (rnd.Next(1, 7));
dado2 = (rnd.Next(1, 7));

Console.WriteLine("Dado 1: " + dado1);
Console.WriteLine("Dado 2: " + dado2);

if(dado1 == dado2 || dado2 + dado1 == 7 || dado1 + dado2 == 11)
{
    Console.WriteLine("Voce ganhou!");
}
else
{
    Console.WriteLine("Você perdeu!");
}
