int escolha;

Console.Write("Escolha um dos programas: ");
escolha = Convert.ToInt32(Console.ReadLine());

if(escolha == 0)
{
    Int32 N = 1;
    Int32 count = 1;
    Double preco, soma;
    soma = 0;

    Console.Write("Entre com o numero de produtos: ");
    N = Convert.ToInt32(Console.ReadLine());
    while (count < (N + 1))
    {
        Console.Write("Entre com o preço do " + count + "° produto: ");
        preco = Convert.ToInt32(Console.ReadLine());
        soma = soma + preco;
        count++;
    }
    double media = soma / N;
    Console.WriteLine("A média dos preços é de: " + media);
}

else if(escolha == 1)
{
    int [] lista = new int[10];
    Random rnd = new Random();

    for(int i = 0; i < lista.Length; i++)
    {
        lista[i] = rnd.Next(10, 100);
    }
    for(int i = 0; i < lista.Length; i++)
    {
        Console.WriteLine(lista[i]);
    }
}

else
{
    Console.WriteLine("Programa inválido!");
}