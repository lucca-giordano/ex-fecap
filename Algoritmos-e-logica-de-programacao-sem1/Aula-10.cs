// jogo senha
Random rnd = new Random();
int[] senha = new int[4];
int[] chute = new int[4];
int tent = 1;

for (int i = 0; i < senha.Length; i++)
{
    senha[i] = rnd.Next(1, 6);
}

while(tent > 0)
{
    for (int i = 0; i < chute.Length; i++)
    {
        Console.Write("Entre com a " + (i + 1) + "° jogada: ");
        chute[i] = Convert.ToInt32(Console.ReadLine());
    }

    for (int i = 0; i < senha.Length; i++)
    {

        if (senha[i] == chute[i])
        {
            Console.WriteLine("*");
        }

        else
        {
            Console.WriteLine("?");
        }

    }

    tent--;

    if(tent == 0)
    {
        Console.WriteLine("Voce perdeu!");
    }

    if (senha == chute)
    {
        Console.WriteLine("Você ganhou!");
        break;
    }
}
