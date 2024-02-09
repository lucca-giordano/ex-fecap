import java.util.Scanner;

public class Exemplo8 {
	
	public static void main(String[] args) {
		Scanner ler = new Scanner(System.in);
		int numero, cont, soma;
		cont=1;
		soma=0;
		while(cont<=10) {
			System.out.println("Informe um numero: ");
			numero = ler.nextInt();
			soma+=numero;
			cont++;
		}
		System.out.println("Soma: " +soma);
		
	}
	
}
