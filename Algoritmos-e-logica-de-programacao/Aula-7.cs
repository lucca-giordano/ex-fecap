float preco, media, count, soma;
int lim;

count = 1;
soma = 0;

Console.Write("Insira quantos numeros gostaria de inserir: ");
lim = Convert.ToInt32(Console.ReadLine());


while(count <= lim)
{
    Console.Write("Insira o "+count+"° valor: R$");
    preco = (float)Convert.ToDecimal(Console.ReadLine());
    soma += preco;
    count++;
}

media = (soma / lim);

Console.WriteLine("A média dos valores foi: R$" + media);
