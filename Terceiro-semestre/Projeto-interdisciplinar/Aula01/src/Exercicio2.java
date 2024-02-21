import java.util.Scanner;

/*12. Desenvolva um gerador de tabuada, capaz de gerar a tabuada
de qualquer número inteiro entre 1 a 10. O usuário deve informar
de qual numero ele deseja ver a tabuada. 
*/

public class Exercicio2 {
    public static void main(String[] args) {
        // Instanciando o Scanner
        Scanner ler = new Scanner(System.in);

        // Declarando as variáveis
        int numero;

        // Perguntando o número
        System.out.println("Digite o número: ");
        numero = ler.nextInt();

        // Gerando a tabuada
        for(int i = 1; i <= 10; i++) {
            System.out.println(numero + " x " + i + " = " + (numero * i));
        }
    }
}
