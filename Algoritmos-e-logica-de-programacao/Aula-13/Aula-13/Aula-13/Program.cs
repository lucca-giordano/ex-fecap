int BuscaSequencial(Int32 [] lista, Int32 elem)
{
    int i = 0;
    while(i < lista.Length && lista[i] != elem)
    {
        i++;
    }
    
    if (i == lista.Length)
    {
        i = -1;
    }

    return i;
}

int BuscaBinaria()
{
    return 0;
}

DateTime dt1 = DateTime.Now;
int N = 1000000000;
Int32[] lista = new Int32[N];

Random rnd = new Random();

for(int i = 0; i < lista.Length; i++)
{
    lista[i] = rnd.Next(0, 1000000000);
}

/*
for (int i = 0; i < lista.Length; i++)
{
    Console.WriteLine(lista[i]);
}*/

int num = 88;
int pos = BuscaSequencial(lista, num);

DateTime dt2 = DateTime.Now;
Console.Write("O numero " + num + " foi achado na posição: ");
Console.WriteLine(pos);
Console.WriteLine("O processo demorou um total de: " + (dt2 - dt1) + " segundos");
