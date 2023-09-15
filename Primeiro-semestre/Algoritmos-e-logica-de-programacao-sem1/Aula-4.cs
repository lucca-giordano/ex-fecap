//Input de usuario

Console.Write("escolha o programa [1, 2]: ");
int escolha = Convert.ToInt32(Console.ReadLine());

if (escolha == 1)
{
    //ex1
    double n1, pi, po, mediaNota;
    Console.Write("Insira seu nome: ");
    string nome = Console.ReadLine();
    Console.WriteLine("Olá " + nome + "!!");
    Console.WriteLine("Bem vindo a FECAP!!");

    Console.Write("Insira sua N1: ");
    n1 = Convert.ToDouble(Console.ReadLine());

    Console.Write("Insira sua PI: ");
    pi = Convert.ToDouble(Console.ReadLine());

    Console.Write("Insira sua PO: ");
    po = Convert.ToDouble(Console.ReadLine());

    mediaNota = 0.2 * n1 + 0.3 * pi + 0.5 * po;
    Console.WriteLine("Sua média é: " + mediaNota);

    if (mediaNota >= 6)
    {
        Console.WriteLine("Você está aprovado!");
    }

    else if (mediaNota >= 4)
    {
        Console.WriteLine("Você está de exame, precisa de 6 pontos!");
    }

    else if (mediaNota >= 2)
    {
        Console.WriteLine("Você está de exame, precisa de 7 pontos!");
    }

    else
    {
        Console.WriteLine("Você está reprovado!");
    }


}

else if (escolha == 2)
{
    //ex2

    string nomeProduto;
    double preco1, preco2, preco3, media, valorIdeal, maiorValor1, maiorValorF;

    Console.Write("Insira o nome do produto: ");
    nomeProduto = Console.ReadLine();

    Console.Write("Insira o preco ideal do produto: ");
    valorIdeal = Convert.ToDouble(Console.ReadLine());

    Console.Write("Insira o preco 1: ");
    preco1 = Convert.ToDouble(Console.ReadLine());

    Console.Write("Insira o preco 2: ");
    preco2 = Convert.ToDouble(Console.ReadLine());

    Console.Write("Insira o preco 3: ");
    preco3 = Convert.ToDouble(Console.ReadLine());

    media = (preco1 + preco2 + preco3) / 3;

    Console.WriteLine("Preço médio do " + nomeProduto + " é R$" + media);

    if (media > valorIdeal)
    {
        Console.WriteLine("O valor está maior que o ideal!");
    }

    else if (media < valorIdeal)
    {
        Console.WriteLine("O valor está menor que o ideal!");
    }
    else
    {
        Console.WriteLine("O valor é ideal!");
    }

    Console.WriteLine("O maior valor inserido foi: R$" + Math.Max(preco1, Math.Max(preco2, preco3)));

}

else
{
    Console.WriteLine("Opção inválida");
}
