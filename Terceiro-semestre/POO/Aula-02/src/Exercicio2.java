import java.util.Scanner;

//Faça um programa que recebe 10 numeros inteiros e mostre a quantidade de numeros entre 30 e 90

public class Exercicio2 {
	public static void main(String[] args) {
		Scanner ler = new Scanner(System.in);
		int[] numeros = new int[10];
		int contador = 0;
		for (int i = 0; i < 10; i++) {
			System.out.println("Digite o " + (i + 1) + "º número: ");
			numeros[i] = ler.nextInt();
			if (numeros[i] >= 30 && numeros[i] <= 90) {
				contador++;
			}
		}
		System.out.println("Quantidade de números entre 30 e 90: " + contador);
		ler.close();
		
		
	}
}
