Random rnd= new Random();
Double[] Preco = new Double[5];
int i;
double soma = 0;
i = 0;
while (i < Preco.Length)
{
    Preco[i] = rnd.NextDouble() * 100;
    soma = soma + Preco[i];
    Console.WriteLine("Novo numero: " + Math.Round(Preco[i], 2));
    i++;
}

Console.WriteLine("A soma é: " + Math.Round(soma, 2));
Console.WriteLine("A média é: " + Math.Round((soma / Preco.Length), 2));

double maior = Preco[0];
double menor = Preco[0];

for (i = 0; i < Preco.Length; i++)
{
    if (Preco[i] > maior)
    {
        maior = Preco[i];
    }

    if(Preco[i] < menor)
    {
        menor = Preco[i];
    }
}

Console.WriteLine("O maior número sorteado foi: " + Math.Round(maior, 2));
Console.WriteLine("O menor número sorteado foi: " + Math.Round(menor, 2));
