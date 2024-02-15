import java.util.Scanner;

public class Exercicio1 {
	 public static void main(String[] args) {
		    Scanner ler = new Scanner(System.in);
		    float qtdlitros;
		    double preco;
		    String opcao;

		    System.out.println("Informe a quantidade de litros: ");
		    
		    qtdlitros = ler.nextFloat();
		    ler.nextLine();
		    System.out.println("Escolha a opção:\nA:Alcool;\nG:Gasolina;\nD:Diesel");
		    opcao = ler.nextLine();
		    
		    if(opcao.equals("A") || opcao.equals("a")){
		      preco = qtdlitros * 3.25;
		      System.out.println(qtdlitros + " litros de alcool custam " + preco);
		    }
		    else if(opcao.equals("G") || opcao.equals("g")){
		      preco = qtdlitros * 5.58;
		      System.out.println(qtdlitros + " litros de gasolina custam " + preco);
		    }
		    else if(opcao.equals("D") || opcao.equals("d")){
		      preco = qtdlitros * 5.95;
		      System.out.println(qtdlitros + " litros de gasolina custam " + preco);
		    }
		    else{
		      System.out.println("Opção inválida");
		    }
		    
		  }
}
