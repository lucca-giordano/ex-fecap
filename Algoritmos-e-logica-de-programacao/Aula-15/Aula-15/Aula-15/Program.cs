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

else if(escolha == 2)
{

    Double menorColuna(Double [][] matriz, int col)
    {
        double menor = matriz[col][0];
        for(int j = 0; j < matriz[col].Length; j++)
        {
            if(matriz[col][j] < menor)
            {
            menor = matriz[col][j];
            }
        }

        return menor;
    }

    Double[][] matriz;
    String[] insumos = new String[4];

    insumos[0] = "Farinha";
    insumos[1] = "Ovo";
    insumos[2] = "Leite condensado";
    insumos[3] = "Chocolate";

    matriz = new Double[4][];
    for (int i = 0; i < 4; i++)
    {
        matriz[i] = new Double[5];
    }

    for(int col = 0; col < 4; col++)
    {
        for(int row = 0; row < 4; row++)
        {
            Console.Write("Entre com o preço do " + insumos[col] + ": ");
            matriz[row][col] = Convert.ToDouble(Console.ReadLine());
        }
    }

    Double menorFarinha = menorColuna(matriz, 0);
    Double menorOvo = menorColuna(matriz, 1);
    Double menorLeite = menorColuna(matriz, 2);
    Double menorChocolate = menorColuna(matriz, 3);

    Console.WriteLine(menorFarinha);
    Console.WriteLine(menorOvo);
    Console.WriteLine(menorLeite);
    Console.WriteLine(menorChocolate);

}

else
{
    Console.WriteLine("Programa inválido!");
}