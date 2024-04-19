package Prova;

public class Conta implements Interface{
	
	//Atributos
	private int numeroConta;
	private float saldoConta;
	
	//Construtor
	public Conta(int numeroConta, int saldoConta) {
		this.numeroConta = numeroConta;
		this.saldoConta = saldoConta;
	}
	
	//Getters
	public int getNumeroConta() {
		return numeroConta;
	}
	
	public float getSaldoConta() {
		return saldoConta;
	}
	
	//Setters
	public void somarSaldoConta(float valor) {
		saldoConta += valor;
	}
	
	public void subSaldoConta(float valor) {
		saldoConta -= valor;
	}
	
	
	//Funções da Interface
	@Override
	public void depositar(float valor) {
		System.out.println("Valor depositado:" + valor);
		
	}
	@Override
	public void sacar(float valor) {
		if(getSaldoConta() >= valor) {
			System.out.println("Valor sacado:" + valor);
		}else {
			System.out.println("Saldo insuficiente!");
		}
	}
	

}
