package Prova;

public class Ex1 {

	public static void main(String[] args) {
		System.out.print("Resultado: " + multiplicar(4));
	}

 	public static int multiplicar(int N) {
		if(N == 1) {
 		return 1;
		}
		return N * multiplicar(N-1);
	}

}