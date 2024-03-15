package Exemplo1;

public class SemEstatico {
	private int numeroDeInstancias = 0;
	
	public SemEstatico() {
		numeroDeInstancias ++;
	}
	
	public int getNumeroDeInstancias() {
		return numeroDeInstancias;
	}
}
