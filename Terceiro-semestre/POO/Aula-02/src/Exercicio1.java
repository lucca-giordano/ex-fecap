import java.util.Scanner;

public class Exercicio1 {
	public static void main(String[] args) {
		Scanner ler = new Scanner(System.in);
		float qtdlitros;
		double preco;
		String opcao;
		
		System.out.println("Informe a quantidade de litros: ");
		qtdlitros = ler.nextFloat();
		
		System.out.println("Escolha a opção:\nA:Alcool;\nG:Gasolina;\nD:Diesel");
		opcao = ler.nextLine();
		
		switch(opcao) {
		case "A":
			preco = qtdlitros * 3.25f;
			System.out.println("Preço total: " + preco);
			break;
			
		case "G":
			preco = qtdlitros * 5.58f;
			System.out.println("Preço total: " + preco);
			break;
			
		case "D":
			preco = qtdlitros * 5.95f;
			System.out.println("Preço total: " + preco);
			break;
		}
	}
}
