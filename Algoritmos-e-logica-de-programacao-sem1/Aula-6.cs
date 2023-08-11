double count, soma, lim;
count = 1;
soma = 0;

Console.Write("Insira a quantidade de numeros que deseja somar: ");
lim = Convert.ToDouble(Console.ReadLine());

while(count <= lim)
{
    soma += count;
    count++;
}

Console.WriteLine("A soma dos numeros é: "+soma);
