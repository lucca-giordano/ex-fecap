Random rnd= new Random();
Double[] Preco = new Double[5];
int i;
double soma = 0;
Preco[0] = rnd.NextDouble() * 100;
Preco[1] = rnd.NextDouble() * 100;
Preco[2] = rnd.NextDouble() * 100;
Preco[3] = rnd.NextDouble() * 100;
Preco[4] = rnd.NextDouble() * 100;
i = 0;
while (i < Preco.Length)
{
    soma = soma + Preco[i];
    Console.WriteLine("Novo numero: " + Preco[i]);
    i++;
}

Console.WriteLine("A soma é: " + soma);
