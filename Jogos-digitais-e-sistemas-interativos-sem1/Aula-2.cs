/* DESAFIO:
Faça uma cauculadora
*/

using System;

class Program {
  public static void Main (string[] args) {

    int num1 = 0;
    int num2 = 0;
    string sim;

    Console.Write("Digite o primeiro número: ");
    num1 = Convert.ToInt32(Console.ReadLine());
    Console.Write("\n");

    Console.Write("Digite o segundo número: ");
    num2 = Convert.ToInt32(Console.ReadLine());
    Console.Write("\n");

    Console.Write("Digite o simbolo: (+ - / *): ");
    sim = Console.ReadLine();
    Console.Write("\n");

    if(sim == "+"){
      Console.WriteLine("Seu resultado é: " + (num1 + num2));
    }

    else if(sim == "-"){
      Console.WriteLine("Seu resultado é: " + (num1 - num2));
    }

    else if(sim == "/"){
      Console.WriteLine("Seu resultado é: " + (num1 / num2));
    }

    else if(sim == "*"){
      Console.WriteLine("Seu resultado é: " + (num1 * num2));
    }

    else{
      Console.WriteLine("Simbolo inválido!");
    }

  }
}
