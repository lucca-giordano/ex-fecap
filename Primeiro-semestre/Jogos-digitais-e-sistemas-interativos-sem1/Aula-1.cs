/* DESAFIO:
Imprimir 3 frases
Declarar uma váriavel "nome"
Input de nome

Converter string para inteiro
Testar maioridade

*/

using System;

class Program {
  public static void Main (string[] args) {

    string nome;
    int idade = 0;
    
    Console.WriteLine("Ola mundo 1");
    Console.WriteLine("Ola mundo 2");
    Console.WriteLine("Ola mundo 3"); //3 outputs
    Console.Write("Dgite seu nome: ");
    nome = Console.ReadLine(); //input nome

    Console.Write("Digite sua idade: ");
    idade = Convert.ToInt32(Console.ReadLine());

    
    Console.WriteLine("Nome: " + nome); //output nome
    Console.WriteLine("Idade: " + idade); //output idade
    if(idade >= 18){
      Console.WriteLine("Você é maior de idade!");
    }
    else if(idade < 18 && idade > 0){
      Console.WriteLine("Você é menor de idade!");
    }
    else{
      Console.WriteLine("Idade inválida.");
    }
    
  }
}
