package Exemplo1;

public class Exemplo_CarrosConstrutor {
	public static void main(String[] args) {
		Carro terceiro = new Carro();
		terceiro.marca = "Ford";
		//terceiro.modelo = "Fiesta";
		System.out.println("Marca: " + terceiro.marca);
		System.out.println("Modelo: " + terceiro.modelo);

		/*
		 * No objeto carro, temos:
		    public Carro(){
				modelo = "Desconhecido";
			}
			public Carro(String marca){
				this.marca = marca;
			}

			No primeiro caso, o construtor padrão é chamado, e o 
			modelo é inicializado com "Desconhecido".
			No segundo caso, o construtor com parâmetro é chamado, e a marca 
			é inicializada com o valor passado, como:
			Carro terceiro = new Carro("Ford");
		*/
	}
}
