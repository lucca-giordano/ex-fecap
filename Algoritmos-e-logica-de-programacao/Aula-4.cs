//Input de usuario

//ex1
Console.Write("Insira seu nome: ");
string nome = Console.ReadLine();
Console.WriteLine("Olá " + nome + "!!");
Console.WriteLine("Bem vindo a FECAP!!");

//ex2
string nomeProduto;
double preco1, preco2, preco3, media;

Console.Write("Insira o nome do produto: ");
nomeProduto = Console.ReadLine();

Console.Write("Insira o preco 1: ");
preco1 = Convert.ToDouble(Console.ReadLine());



Console.Write("Insira o preco 2: ");
preco2 = Convert.ToDouble(Console.ReadLine());


Console.Write("Insira o preco 3: ");
preco3 = Convert.ToDouble(Console.ReadLine());

media = (preco1 + preco2 + preco3) / 3;

Console.WriteLine("Preço médio do " + nomeProduto + " é R$" + media);
