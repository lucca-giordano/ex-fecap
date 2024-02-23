package Exemplo2;

import java.util.Scanner;

public class Exemplo_Gato {

	public static void main(String[] args) {
		Gato gato = new Gato();
		Scanner ler = new Scanner(System.in);

		System.out.println("Digite o nome do gato: ");
		gato.nome = ler.nextLine();
		System.out.println("Digite a cor do gato: ");
		gato.cor = ler.nextLine();
		System.out.println("Digite a raça do gato: ");
		gato.raca = ler.nextLine();
		System.out.println("Digite a idade do gato: ");
		gato.idade = ler.nextInt();
		System.out.println("Digite o peso do gato: ");
		gato.peso = ler.nextDouble();

		System.out.println("Nome: " + gato.nome);
		System.out.println("Cor: " + gato.cor);
		System.out.println("Raça: " + gato.raca);
		System.out.println("Idade: " + gato.idade);
		System.out.println("Peso: " + gato.peso);
		ler.close();	

	}

}
