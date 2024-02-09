import java.util.Scanner;

public class Exemplo5 {
	public static void main(String[] args) {
		Scanner ler = new Scanner(System.in);
		int idade;
		System.out.println("Informe a idade: ");
		idade = ler.nextInt();
		if(idade > 0 && idade <= 15) {
			System.out.println("Não eleitor.");
		}
		else if(idade>=16 && idade<=65) {
			System.out.println("Eleitor!");
		}
		else if(idade>65) {
			System.out.println("Eleitor optativo)");
		}
		else {
			System.out.println("Valor incorreto!");
		}
		}
}
