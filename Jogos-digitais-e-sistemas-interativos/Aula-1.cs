/* DESAFIO:
Imprimir 3 frases
Declarar uma váriavel "nome"
Input de nome
*/

using System;

class Program {
  public static void Main (string[] args) {
    Console.WriteLine("Ola mundo 1");
    Console.WriteLine("Ola mundo 2");
    Console.WriteLine("Ola mundo 3"); //3 outputs
    string nome = Console.ReadLine(); //input
    Console.WriteLine("Nome: " + nome); //output
  }
}
