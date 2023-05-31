/*
int numero = 1;
string frase = "Ola mundo!";
bool verdadeiro = true;

Console.WriteLine(numero);
Console.WriteLine(frase);
Console.WriteLine(verdadeiro);
*/

/*
int num1 = 15;
int num2 = 10;
string num3 = "5";

int soma = num1 + num2;

Console.WriteLine(soma + num3);
*/

/*
int num1 = 10;

if(num1 == 15){
    Console.WriteLine("O numero é 15");
}

else if(num1 == 10){
    Console.WriteLine("O numero é 10");
}

else{
    Console.WriteLine("O numero não é 15 nem 10");
}
*/

/*
int num = 20;

if(num <= 20){
    Console.WriteLine("O numero é menor ou igual a 20");
}

if(num <= 10){
    Console.WriteLine("O numero é menor ou igual a 10");
}
else{
    Console.WriteLine("O numero é maior que 10");
}
*/

/*
//while - for

int num = 10;
int controle = 0;

while(num == 10){
    Console.WriteLine(controle);
    controle += 99;
}

do{
    Console.WriteLine(num);
}while(num > 10);

for(int i = 0; i <= 10; i++){
    Console.WriteLine(i);
}

*/

/*
int[] vetor = new int[4];

for(int i = 0; i < vetor.Length; i++){
    vetor[i] = i;
}

for(int i = 0; i < vetor.Length; i++){
    Console.WriteLine(vetor[i]);
}
*/

/*
int[,] matriz = new int[2,3];
int[][] matriz2 = new int[2][];

matriz[0, 0] = 4;
matriz[0, 1] = 5;
matriz[0, 2] = 6;
matriz[1, 0] = 7;
matriz[1, 1] = 8;
matriz[1, 2] = 9;

matriz2[0][0] = 0;


Console.WriteLine(matriz[0,1]);
for(int i = 0; i < 3; i++){
    Console.Write(matriz[0, i]);    
}
*/

/*

int soma(int x, int y){
    int soma = x + y;
    return soma;
}

int valor = soma(10, 20);

Console.WriteLine(soma(10, 20));
Console.WriteLine(soma(30, 40));
Console.WriteLine(soma(50, 60));
Console.WriteLine(soma(70, 80));

string frase(){
    return "Ola mundo!";
}

bool verdadeiro(){
    return true;
}

double soma2(double x, double y){
    return x + y;
}

void escrever(string frase){
    Console.WriteLine(frase);
}

*/