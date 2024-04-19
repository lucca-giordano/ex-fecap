package Prova;

import java.util.Random;
import java.util.Scanner;

public class Ex2 {

	public static void main(String[] args) {
		
		Random gerador = new Random();
		
		Pessoa pessoa1 = new Pessoa("Lucas", "56306239976");
		Conta conta1 = new Conta(gerador.nextInt(20), 1000);
			
		int escolha;
		Scanner scanner = new Scanner(System.in);
		
		System.out.println("--------------------------");
		System.out.println("|Bem vindo ao banco FECAP|");
		System.out.println("--------------------------\n");
	
		System.out.println("Dados da conta: \n" + "N° conta: " + conta1.getNumeroConta() + "\nNome: " + pessoa1.getNome() + "\n");
		System.out.println("Escolha uma das opções abaixo: ");
		System.out.println("1- Depositar");
		System.out.println("2- Sacar");
		System.out.println("3- Imprimir Saldo");
		escolha = scanner.nextInt();
		
		switch(escolha) {
		case 1:
			int qtdDep;
			System.out.println("Valor a ser depositado: ");
			qtdDep = scanner.nextInt();
			conta1.depositar(qtdDep);
			conta1.somarSaldoConta(qtdDep);
			System.out.println("Novo valor em conta: " + conta1.getSaldoConta());
			break;
			
		case 2:
			int qtdSaque;
			System.out.println("Valor a ser sacado: ");
			qtdSaque = scanner.nextInt();
			conta1.sacar(qtdSaque);
			conta1.subSaldoConta(qtdSaque);
			System.out.println("Novo valor em conta: " + conta1.getSaldoConta());
			break;
			
		case 3:
			System.out.println("Saldo da conta: " + conta1.getSaldoConta());
			break;
			
		default:
			System.out.println("Escolha invalida");
			break;
		}
		
	}

}
